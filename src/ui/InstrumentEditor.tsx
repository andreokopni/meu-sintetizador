import { useState } from 'react'
import { effectiveParams, getInstrument, listInstruments } from '../audio/instruments/registry'
import type { ParamSpec } from '../audio/instruments/types'
import {
  createUserTimbre,
  deleteUserTimbre,
  editUserTimbre,
  getTimbre,
  isUserTimbre,
  setUserTimbreParam,
} from '../audio/instruments/userTimbres'
import type { ParamValue, Track } from '../model/project'
import { useProjectStore } from '../store/useProjectStore'
import { useInstruments } from './InstrumentSelect'

const SLIDER_STEPS = 1000

type NumberSpec = Extract<ParamSpec, { type: 'number' }>

/** Converte valor <-> posição do slider (0..SLIDER_STEPS), com escala logarítmica opcional. */
function toSlider(spec: NumberSpec, value: number): number {
  const t = spec.log
    ? Math.log(value / spec.min) / Math.log(spec.max / spec.min)
    : (value - spec.min) / (spec.max - spec.min)
  return Math.round(Math.min(1, Math.max(0, t)) * SLIDER_STEPS)
}

function fromSlider(spec: NumberSpec, pos: number): number {
  const t = pos / SLIDER_STEPS
  const raw = spec.log ? spec.min * Math.pow(spec.max / spec.min, t) : spec.min + t * (spec.max - spec.min)
  const stepped = Math.round(raw / spec.step) * spec.step
  return Number(Math.min(spec.max, Math.max(spec.min, stepped)).toFixed(4))
}

export function formatValue(spec: NumberSpec, value: number): string {
  let text: string
  if (spec.unit === 'Hz' && value >= 1000) text = `${(value / 1000).toFixed(2)} k`
  else if (spec.step >= 1) text = String(Math.round(value))
  else if (spec.step >= 0.01) text = value.toFixed(2)
  else text = value.toFixed(3)
  return spec.unit ? `${text} ${spec.unit === 'Hz' && value >= 1000 ? 'Hz' : spec.unit}` : text
}

/** Controle de um parâmetro (slider ou lista), reutilizado pelo construtor. */
export function ParamControl({
  spec,
  value,
  onChange,
}: {
  spec: ParamSpec
  value: ParamValue
  onChange(value: ParamValue): void
}) {
  if (spec.type === 'select') {
    return (
      <div className="param">
        <span className="label">{spec.label}</span>
        <span />
        <select value={String(value)} onChange={(e) => onChange(e.target.value)}>
          {spec.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    )
  }
  const num = Number(value)
  return (
    <div className="param">
      <span className="label">{spec.label}</span>
      <span className="value">{formatValue(spec, num)}</span>
      <input
        type="range"
        min={0}
        max={SLIDER_STEPS}
        value={toSlider(spec, num)}
        onChange={(e) => onChange(fromSlider(spec, Number(e.target.value)))}
      />
    </div>
  )
}

function groupSpecs(specs: ParamSpec[]): [string, ParamSpec[]][] {
  const groups = new Map<string, ParamSpec[]>()
  for (const spec of specs) groups.set(spec.group, [...(groups.get(spec.group) ?? []), spec])
  return [...groups]
}

/** Edita um timbre do usuário e marca o projeto como alterado (o timbre vai embutido no arquivo). */
function editParam(track: Track, key: string, value: ParamValue) {
  setUserTimbreParam(track.instrumentId, key, value)
  useProjectStore.setState({ dirty: true })
}

/**
 * Painel de timbre da faixa selecionada.
 * Instrumentos de fábrica são fixos (somente leitura): para mudar o som, "Personalizar" cria
 * um timbre do usuário, que é editável e salvo na biblioteca "Meus timbres".
 */
export function InstrumentEditor({ onOpenBuilder }: { onOpenBuilder?: () => void }) {
  useInstruments() // re-renderiza quando instrumentos/timbres mudam
  const track = useProjectStore((s) => s.project.tracks.find((t) => t.id === s.selectedTrackId))
  const { checkpoint, updateTrack } = useProjectStore.getState()

  if (!track) {
    return (
      <aside className="instrument-editor">
        <div className="subtitle">Nenhuma faixa selecionada.</div>
      </aside>
    )
  }

  const def = getInstrument(track.instrumentId)
  const isUser = isUserTimbre(track.instrumentId)
  const values = effectiveParams(track)
  const visibleSpecs = def.editor === 'builder' ? def.params.filter((s) => s.group === 'Macros') : def.params

  return (
    <aside className="instrument-editor">
      <h2 style={{ color: track.color }}>{track.name}</h2>
      {isUser ? (
        <input
          className="timbre-title"
          type="text"
          value={def.name}
          title="Nome do timbre"
          onChange={(e) => editUserTimbre(track.instrumentId, { name: e.target.value })}
        />
      ) : (
        <div className="subtitle">
          {def.name} · {def.category} <span title="Timbre de fábrica (fixo)">🔒</span>
        </div>
      )}

      <h3>Mixagem</h3>
      <div className="param">
        <span className="label">Pan</span>
        <span className="value">
          {track.pan === 0 ? 'C' : track.pan < 0 ? `E ${Math.round(-track.pan * 100)}` : `D ${Math.round(track.pan * 100)}`}
        </span>
        <input
          type="range"
          min={-1}
          max={1}
          step={0.01}
          value={track.pan}
          onPointerDown={checkpoint}
          onDoubleClick={() => updateTrack(track.id, { pan: 0 })}
          onChange={(e) => updateTrack(track.id, { pan: Number(e.target.value) }, false)}
        />
      </div>

      {isUser ? (
        <>
          {def.editor === 'builder' && (
            <button className="active open-builder" onClick={onOpenBuilder}>
              🎛 Abrir construtor
            </button>
          )}
          {groupSpecs(visibleSpecs).map(([group, specs]) => (
            <section key={group}>
              <h3>{group}</h3>
              {specs.map((spec) => (
                <ParamControl
                  key={spec.key}
                  spec={spec}
                  value={values[spec.key]}
                  onChange={(value) => editParam(track, spec.key, value)}
                />
              ))}
            </section>
          ))}
        </>
      ) : (
        <FactoryNotice track={track} onOpenBuilder={onOpenBuilder} />
      )}

      <TimbreFooter track={track} />
    </aside>
  )
}

/** Instrumento de fábrica: explica que é fixo e oferece criar uma cópia editável. */
function FactoryNotice({ track, onOpenBuilder }: { track: Track; onOpenBuilder?: () => void }) {
  const def = getInstrument(track.instrumentId)
  const hasLegacyTweaks = Object.keys(track.params).length > 0

  const personalize = async () => {
    const count = listInstruments().filter((d) => d.category === 'Meus timbres').length
    const name = def.editor === 'builder' ? `Meu timbre ${count + 1}` : `${def.name} (meu)`
    const timbre = await createUserTimbre(name, track.instrumentId, effectiveParams(track))
    useProjectStore.getState().apply((p) => ({
      ...p,
      tracks: p.tracks.map((t) => (t.id === track.id ? { ...t, instrumentId: timbre.id, params: {} } : t)),
    }))
    if (def.editor === 'builder') onOpenBuilder?.()
  }

  return (
    <div className="factory-notice">
      <p>Timbre de fábrica — fixo. Para mudar o som, crie a sua versão:</p>
      <button className="active" onClick={personalize}>
        ✎ Personalizar este som
      </button>
      {hasLegacyTweaks && (
        <p className="small">
          Esta faixa tem ajustes de uma versão anterior (continuam tocando).{' '}
          <button className="link inline" onClick={() => useProjectStore.getState().resetTrackParams(track.id)}>
            Remover ajustes
          </button>
        </p>
      )}
    </div>
  )
}

/** Rodapé discreto: duplicar/excluir timbres do usuário. */
function TimbreFooter({ track }: { track: Track }) {
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  if (!isUserTimbre(track.instrumentId)) return null

  const duplicate = async () => {
    const timbre = await createUserTimbre(name, track.instrumentId, effectiveParams(track))
    useProjectStore.getState().apply((p) => ({
      ...p,
      tracks: p.tracks.map((t) => (t.id === track.id ? { ...t, instrumentId: timbre.id, params: {} } : t)),
    }))
    setNaming(false)
    setName('')
  }

  const remove = async () => {
    const timbre = getTimbre(track.instrumentId)
    if (!timbre || !window.confirm(`Excluir o timbre "${timbre.name}" da sua biblioteca?`)) return
    // Faixas que usam o timbre voltam ao instrumento base com os mesmos parâmetros (o som não muda).
    useProjectStore.getState().apply((p) => ({
      ...p,
      tracks: p.tracks.map((t) =>
        t.instrumentId === timbre.id
          ? { ...t, instrumentId: timbre.baseInstrumentId, params: { ...timbre.params, ...t.params } }
          : t,
      ),
    }))
    await deleteUserTimbre(timbre.id)
  }

  return (
    <div className="timbre-footer">
      {naming ? (
        <form
          className="timbre-name"
          onSubmit={(e) => {
            e.preventDefault()
            duplicate()
          }}
        >
          <input
            type="text"
            autoFocus
            placeholder="Nome da cópia"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setNaming(false)}
          />
          <button type="submit" className="active">Salvar</button>
          <button type="button" onClick={() => setNaming(false)}>✕</button>
        </form>
      ) : (
        <div className="row">
          <button onClick={() => setNaming(true)} title="Criar uma cópia deste timbre">Duplicar</button>
          <button className="danger" onClick={remove}>Excluir timbre</button>
        </div>
      )}
      <p className="small">Alterações neste timbre são salvas automaticamente em "Meus timbres".</p>
    </div>
  )
}
