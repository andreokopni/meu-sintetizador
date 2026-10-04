import { useEffect, useMemo, useRef, useState } from 'react'
import { engine } from '../audio/engine'
import { BUILDER_PARAMS, BUILDER_TEMPLATES, varyParams } from '../audio/instruments/builderParams'
import { getInstrument } from '../audio/instruments/registry'
import type { ParamSpec } from '../audio/instruments/types'
import { editUserTimbre, setUserTimbreParam } from '../audio/instruments/userTimbres'
import { isBlackKey, pitchName, type ParamValues, type Track } from '../model/project'
import { useProjectStore } from '../store/useProjectStore'
import { useInstruments } from './InstrumentSelect'
import { ParamControl } from './InstrumentEditor'

// Ordem e agrupamento dos blocos na tela (os grupos vêm dos ParamSpec).
const BLOCKS: { title: string; groups: string[]; envelope?: 'amp' | 'filter' }[] = [
  { title: 'Oscilador 1', groups: ['Oscilador 1'] },
  { title: 'Oscilador 2', groups: ['Oscilador 2'] },
  { title: 'Sub e ruído', groups: ['Sub e ruído'] },
  { title: 'Filtro', groups: ['Filtro'] },
  { title: 'Envelope do filtro', groups: ['Envelope do filtro'], envelope: 'filter' },
  { title: 'Envelope de volume', groups: ['Envelope de volume'], envelope: 'amp' },
  { title: 'LFO', groups: ['LFO'] },
  { title: 'Efeitos', groups: ['Efeitos'] },
  { title: 'Macros e saída', groups: ['Macros', 'Saída'] },
]

const SPECS_BY_GROUP = BUILDER_PARAMS.reduce<Record<string, ParamSpec[]>>((acc, spec) => {
  ;(acc[spec.group] ??= []).push(spec)
  return acc
}, {})

// Teclas do computador -> semitons a partir do Dó da oitava atual (layout de piano).
const KEY_MAP: Record<string, number> = {
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14,
}

/** Desenho do envelope ADSR (tempos em escala comprimida para caber). */
function EnvelopeCurve({ a, d, s, r }: { a: number; d: number; s: number; r: number }) {
  const W = 220
  const H = 60
  const scale = (t: number) => Math.sqrt(t) * 40 // tempos longos não estouram o desenho
  const hold = 30
  const xa = scale(a)
  const xd = xa + scale(d)
  const xs = xd + hold
  const total = xs + scale(r)
  const k = Math.min(1, (W - 4) / total)
  const y = (v: number) => H - 2 - v * (H - 6)
  const pts = [
    [0, y(0)], [xa * k, y(1)], [xd * k, y(s)], [xs * k, y(s)], [total * k, y(0)],
  ].map(([px, py]) => `${(px + 2).toFixed(1)},${py.toFixed(1)}`)
  return (
    <svg className="env-curve" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <polyline points={pts.join(' ')} />
    </svg>
  )
}

function PreviewKeyboard({ trackId, octave }: { trackId: string; octave: number }) {
  const first = 12 * (octave + 1) // Dó da oitava escolhida
  const keys = Array.from({ length: 25 }, (_, i) => first + i)
  return (
    <div className="preview-keys">
      {keys.map((pitch) => (
        <button
          key={pitch}
          className={isBlackKey(pitch) ? 'black' : 'white'}
          title={pitchName(pitch)}
          onPointerDown={() => engine.previewNote(trackId, pitch, 0.8)}
        >
          {pitch % 12 === 0 ? pitchName(pitch) : ''}
        </button>
      ))}
    </div>
  )
}

/** Construtor de timbres em tela cheia, para a faixa selecionada (timbre do usuário baseado no construtor). */
export function BuilderModal({ track, onClose }: { track: Track; onClose(): void }) {
  useInstruments() // re-renderiza quando o timbre muda
  const def = getInstrument(track.instrumentId)
  const values: ParamValues = { ...def.defaults, ...track.params }
  const original = useMemo(() => ({ ...def.defaults }), [track.instrumentId]) // estado ao abrir
  const edited = useRef<ParamValues | null>(null)
  const [listening, setListening] = useState<'edited' | 'original'>('edited')
  const [octave, setOctave] = useState(3)

  const markDirty = () => useProjectStore.setState({ dirty: true })
  const setAll = (params: ParamValues) => {
    editUserTimbre(track.instrumentId, { params })
    markDirty()
  }
  const setOne = (key: string, value: ParamValues[string]) => {
    setUserTimbreParam(track.instrumentId, key, value)
    setListening('edited')
    markDirty()
  }

  const toggleAB = () => {
    if (listening === 'edited') {
      edited.current = values
      setAll(original)
      setListening('original')
    } else {
      setAll(edited.current ?? values)
      setListening('edited')
    }
  }

  // Teclado do computador toca notas; Esc fecha; Z/X mudam a oitava.
  useEffect(() => {
    const held = new Set<string>()
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'text') return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const key = e.key.toLowerCase()
      if (key === 'escape') {
        onClose()
      } else if (key === 'z' || key === 'x') {
        setOctave((o) => Math.min(6, Math.max(1, o + (key === 'x' ? 1 : -1))))
      } else if (key in KEY_MAP) {
        if (!held.has(key)) engine.previewNote(track.id, 12 * (octave + 1) + KEY_MAP[key], 0.8)
        held.add(key)
      } else {
        return
      }
      e.preventDefault()
      e.stopImmediatePropagation()
    }
    const onKeyUp = (e: KeyboardEvent) => held.delete(e.key.toLowerCase())
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp, true)
    }
  }, [track.id, octave, onClose])

  const n = (k: string) => Number(values[k])

  return (
    <div className="builder-overlay" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="builder">
        <header>
          <span className="builder-title">🎛 Construtor</span>
          <input
            type="text"
            className="builder-name"
            value={def.name}
            onChange={(e) => editUserTimbre(track.instrumentId, { name: e.target.value })}
            title="Nome do timbre"
          />
          <select
            value=""
            onChange={(e) => {
              const template = BUILDER_TEMPLATES.find((t) => t.id === e.target.value)
              if (template && window.confirm(`Substituir o timbre atual pelo modelo "${template.name}"?`)) {
                setAll(template.params)
                setListening('edited')
              }
            }}
          >
            <option value="">Começar de um modelo…</option>
            {BUILDER_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button onClick={() => { setAll(varyParams(values)); setListening('edited') }} title="Pequenas mudanças aleatórias">
            🎲 Variar
          </button>
          <button
            className={listening === 'original' ? 'active' : ''}
            onClick={toggleAB}
            title="Alterna entre o som atual e como estava ao abrir o construtor"
          >
            A/B: {listening === 'original' ? 'ouvindo original' : 'ouvindo editado'}
          </button>
          <button onClick={() => { setAll(original); setListening('edited') }} title="Volta ao som de quando o construtor foi aberto">
            ↺ Desfazer tudo
          </button>
          <div className="spacer" />
          <button onClick={onClose} title="Fechar (Esc)">✕</button>
        </header>

        <div className="builder-grid">
          {BLOCKS.map((block) => (
            <section key={block.title} className="builder-block">
              <h3>{block.title}</h3>
              {block.envelope === 'amp' && <EnvelopeCurve a={n('attack')} d={n('decay')} s={n('sustain')} r={n('release')} />}
              {block.envelope === 'filter' && (
                <EnvelopeCurve a={n('fAttack')} d={n('fDecay')} s={n('fSustain')} r={n('fRelease')} />
              )}
              {block.groups.flatMap((g) => SPECS_BY_GROUP[g] ?? []).map((spec) => (
                <ParamControl key={spec.key} spec={spec} value={values[spec.key]} onChange={(v) => setOne(spec.key, v)} />
              ))}
            </section>
          ))}
        </div>

        <footer>
          <div className="octave">
            <button onClick={() => setOctave((o) => Math.max(1, o - 1))} title="Oitava abaixo (Z)">−</button>
            <span>Oitava {octave}</span>
            <button onClick={() => setOctave((o) => Math.min(6, o + 1))} title="Oitava acima (X)">+</button>
          </div>
          <PreviewKeyboard trackId={track.id} octave={octave} />
          <span className="keys-hint">Toque com o teclado: A W S E D F T G Y H U J K · Z/X oitava</span>
        </footer>
      </div>
    </div>
  )
}
