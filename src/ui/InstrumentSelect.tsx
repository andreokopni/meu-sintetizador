import { useMemo, useSyncExternalStore } from 'react'
import { getInstrumentsVersion, listInstruments, onInstrumentsChanged } from '../audio/instruments/registry'
import type { InstrumentDefinition } from '../audio/instruments/types'

export function useInstruments(): InstrumentDefinition[] {
  const version = useSyncExternalStore(onInstrumentsChanged, getInstrumentsVersion)
  return useMemo(() => listInstruments(), [version])
}

interface Props {
  value: string
  onChange(id: string): void
  className?: string
}

/** Seletor de instrumentos agrupado por categoria. */
export function InstrumentSelect({ value, onChange, className }: Props) {
  const instruments = useInstruments()
  const groups = useMemo(() => {
    const map = new Map<string, InstrumentDefinition[]>()
    for (const def of instruments) map.set(def.category, [...(map.get(def.category) ?? []), def])
    return [...map]
  }, [instruments])

  return (
    <select
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
    >
      {groups.map(([category, defs]) => (
        <optgroup key={category} label={category}>
          {defs.map((def) => (
            <option key={def.id} value={def.id}>
              {def.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
