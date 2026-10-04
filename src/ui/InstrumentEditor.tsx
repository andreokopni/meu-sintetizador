import { effectiveParams, getInstrument } from '../audio/instruments/registry'
import type { ParamSpec } from '../audio/instruments/types'
import type { ParamValue } from '../model/project'
import { useProjectStore } from '../store/useProjectStore'
import { useInstruments } from './InstrumentSelect'

const SLIDER_STEPS = 1000

/** Converte valor <-> posição do slider (0..SLIDER_STEPS), com escala logarítmica opcional. */
function toSlider(spec: Extract<ParamSpec, { type: 'number' }>, value: number): number {
  const t = spec.log
    ? Math.log(value / spec.min) / Math.log(spec.max / spec.min)
    : (value - spec.min) / (spec.max - spec.min)
  return Math.round(Math.min(1, Math.max(0, t)) * SLIDER_STEPS)
}

function fromSlider(spec: Extract<ParamSpec, { type: 'number' }>, pos: number): number {
  const t = pos / SLIDER_STEPS
  const raw = spec.log ? spec.min * Math.pow(spec.max / spec.min, t) : spec.min + t * (spec.max - spec.min)
  const stepped = Math.round(raw / spec.step) * spec.step
  return Number(Math.min(spec.max, Math.max(spec.min, stepped)).toFixed(4))
}

function formatValue(spec: Extract<ParamSpec, { type: 'number' }>, value: number): string {
  let text: string
  if (spec.unit === 'Hz' && value >= 1000) text = `${(value / 1000).toFixed(2)} k`
  else if (spec.step >= 1) text = String(Math.round(value))
  else if (spec.step >= 0.01) text = value.toFixed(2)
  else text = value.toFixed(3)
  return spec.unit ? `${text} ${spec.unit === 'Hz' && value >= 1000 ? 'Hz' : spec.unit}` : text
}

function ParamControl({
  spec,
  value,
  onChange,
  onBegin,
}: {
  spec: ParamSpec
  value: ParamValue
  onChange(value: ParamValue, history: boolean): void
  onBegin(): void
}) {
  if (spec.type === 'select') {
    return (
      <div className="param">
        <span className="label">{spec.label}</span>
        <span />
        <select value={String(value)} onChange={(e) => onChange(e.target.value, true)}>
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
        onPointerDown={onBegin}
        onKeyDown={onBegin}
        onChange={(e) => onChange(fromSlider(spec, Number(e.target.value)), false)}
      />
    </div>
  )
}

/** Painel de edição de timbre da faixa selecionada, gerado a partir dos ParamSpec do instrumento. */
export function InstrumentEditor() {
  useInstruments() // re-renderiza se novos instrumentos forem registrados
  const track = useProjectStore((s) => s.project.tracks.find((t) => t.id === s.selectedTrackId))
  const { setTrackParam, resetTrackParams, checkpoint, updateTrack } = useProjectStore.getState()

  if (!track) {
    return (
      <aside className="instrument-editor">
        <div className="subtitle">Nenhuma faixa selecionada.</div>
      </aside>
    )
  }

  const def = getInstrument(track.instrumentId)
  const values = effectiveParams(track)
  const groups = new Map<string, ParamSpec[]>()
  for (const spec of def.params) groups.set(spec.group, [...(groups.get(spec.group) ?? []), spec])

  return (
    <aside className="instrument-editor">
      <h2 style={{ color: track.color }}>{track.name}</h2>
      <div className="subtitle">
        {def.name} · {def.category}
      </div>

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

      {[...groups].map(([group, specs]) => (
        <section key={group}>
          <h3>{group}</h3>
          {specs.map((spec) => (
            <ParamControl
              key={spec.key}
              spec={spec}
              value={values[spec.key]}
              onBegin={checkpoint}
              onChange={(value, history) => setTrackParam(track.id, spec.key, value, history)}
            />
          ))}
        </section>
      ))}

      <h3>&nbsp;</h3>
      <button onClick={() => resetTrackParams(track.id)}>Restaurar padrão do instrumento</button>
    </aside>
  )
}
