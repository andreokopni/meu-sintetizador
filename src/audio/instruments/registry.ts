import type { ParamValues, Track } from '../../model/project'
import { BUILDER_INSTRUMENT } from './builder'
import { loadBuiltinLibraries, samplerDefinition, type SampleLibrary } from './samplers'
import { SYNTH_INSTRUMENTS } from './synths'
import type { InstrumentDefinition } from './types'

// Registro central de instrumentos. Novos instrumentos (samples do usuário,
// vozes geradas por IA, plugins) entram por registerInstrument().

const definitions = new Map<string, InstrumentDefinition>()
const listeners = new Set<() => void>()
let version = 0

export const FALLBACK_INSTRUMENT_ID = 'lead'

export function registerInstrument(def: InstrumentDefinition) {
  definitions.set(def.id, def)
  version++
  listeners.forEach((l) => l())
}

export function unregisterInstrument(id: string) {
  if (definitions.delete(id)) {
    version++
    listeners.forEach((l) => l())
  }
}

/** Muda a cada registro; usado pela interface para saber quando recarregar a lista. */
export function getInstrumentsVersion(): number {
  return version
}

/** Ponto de extensão para bibliotecas de samples (embutidas ou do usuário). */
export function registerSampleLibrary(lib: SampleLibrary) {
  registerInstrument(samplerDefinition(lib))
}

export function getInstrument(id: string): InstrumentDefinition {
  return definitions.get(id) ?? definitions.get(FALLBACK_INSTRUMENT_ID)!
}

/** Parâmetros efetivos: os padrões do instrumento completados pelos da faixa. */
export function effectiveParams(track: Track): ParamValues {
  return { ...getInstrument(track.instrumentId).defaults, ...track.params }
}

export function hasInstrument(id: string): boolean {
  return definitions.has(id)
}

export function listInstruments(): InstrumentDefinition[] {
  return [...definitions.values()]
}

export function onInstrumentsChanged(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

SYNTH_INSTRUMENTS.forEach(registerInstrument)
registerInstrument(BUILDER_INSTRUMENT)

export async function loadBuiltinSamples() {
  try {
    const libs = await loadBuiltinLibraries()
    libs.forEach(registerSampleLibrary)
  } catch (err) {
    console.warn('Samples embutidos indisponíveis:', err)
  }
}
