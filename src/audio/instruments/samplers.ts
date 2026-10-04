import * as Tone from 'tone'
import type { ParamValues } from '../../model/project'
import type { InstrumentDefinition, InstrumentVoice, ParamSpec } from './types'

/**
 * Descrição de uma biblioteca de samples. É o formato usado tanto pelos samples
 * embutidos (public/samples/manifest.json) quanto, no futuro, por samples
 * carregados pelo usuário (com URLs blob:/app://).
 */
export interface SampleLibrary {
  id: string
  name: string
  /** URL base; os arquivos são resolvidos relativos a ela. */
  baseUrl: string
  /** Nota (ex.: "C4", "D#4") -> nome do arquivo. */
  files: Record<string, string>
  release?: number
}

const bufferCache = new Map<string, Promise<Tone.ToneAudioBuffer>>()

function loadBuffer(url: string): Promise<Tone.ToneAudioBuffer> {
  let promise = bufferCache.get(url)
  if (!promise) {
    promise = new Tone.ToneAudioBuffer().load(url)
    promise.catch(() => bufferCache.delete(url))
    bufferCache.set(url, promise)
  }
  return promise
}

async function loadLibrary(lib: SampleLibrary): Promise<Record<string, Tone.ToneAudioBuffer>> {
  const entries = await Promise.all(
    Object.entries(lib.files).map(async ([note, file]) => [note, await loadBuffer(lib.baseUrl + file)] as const),
  )
  return Object.fromEntries(entries)
}

const SAMPLER_PARAMS: ParamSpec[] = [
  { key: 'transpose', label: 'Transpor', group: 'Sampler', type: 'number', min: -24, max: 24, step: 1, unit: 'st' },
  { key: 'attack', label: 'Ataque', group: 'Envelope', type: 'number', min: 0, max: 2, step: 0.001, unit: 's' },
  { key: 'release', label: 'Liberação', group: 'Envelope', type: 'number', min: 0.05, max: 5, step: 0.01, unit: 's', log: true },
  { key: 'cutoff', label: 'Corte (passa-baixa)', group: 'Filtro', type: 'number', min: 200, max: 20000, step: 1, unit: 'Hz', log: true },
]

function createSamplerVoice(lib: SampleLibrary, output: Tone.InputNode, params: ParamValues): InstrumentVoice {
  const filter = new Tone.Filter({ type: 'lowpass', frequency: 20000 }).connect(output)
  let sampler: Tone.Sampler | null = null
  let disposed = false
  let p = params

  const apply = () => {
    filter.frequency.value = Number(p.cutoff)
    if (sampler) {
      sampler.attack = Number(p.attack)
      sampler.release = Number(p.release)
    }
  }

  const ready = loadLibrary(lib).then((buffers) => {
    if (disposed) return
    sampler = new Tone.Sampler({ urls: buffers }).connect(filter)
    apply()
  })
  apply()

  return {
    ready,
    trigger: (pitch, time, duration, velocity) => {
      if (!sampler) return
      const freq = Tone.Frequency(pitch + Number(p.transpose), 'midi').toFrequency()
      sampler.triggerAttackRelease(freq, duration, time, velocity)
    },
    setParams: (next) => {
      p = next
      apply()
    },
    releaseAll: () => sampler?.releaseAll(),
    dispose: () => {
      disposed = true
      sampler?.dispose()
      filter.dispose()
    },
  }
}

/** Semitons além do sample mais grave/agudo em que o reajuste de altura ainda soa natural. */
const RANGE_MARGIN = 4

function naturalRange(lib: SampleLibrary): [number, number] | undefined {
  const pitches = Object.keys(lib.files).map((note) => Tone.Frequency(note).toMidi())
  if (!pitches.length) return undefined
  return [Math.min(...pitches) - RANGE_MARGIN, Math.max(...pitches) + RANGE_MARGIN]
}

export function samplerDefinition(lib: SampleLibrary): InstrumentDefinition {
  return {
    range: naturalRange(lib),
    id: `sample:${lib.id}`,
    name: lib.name,
    category: 'Sampler',
    params: SAMPLER_PARAMS,
    defaults: { transpose: 0, attack: 0, release: lib.release ?? 1, cutoff: 20000 },
    focusPitch: 60,
    create: (output, params) => createSamplerVoice(lib, output, params),
  }
}

/** Formato do public/samples/manifest.json (gerado por scripts/fetch-samples.mjs). */
interface Manifest {
  instruments: { id: string; name: string; folder: string; release?: number; files: Record<string, string> }[]
}

export async function loadBuiltinLibraries(manifestUrl = 'samples/manifest.json'): Promise<SampleLibrary[]> {
  const res = await fetch(manifestUrl)
  if (!res.ok) throw new Error(`Não foi possível carregar ${manifestUrl}`)
  const manifest = (await res.json()) as Manifest
  const base = new URL(manifestUrl, document.baseURI)
  return manifest.instruments.map((inst) => ({
    id: inst.id,
    name: inst.name,
    baseUrl: new URL(`${inst.folder}/`, base).toString(),
    files: inst.files,
    release: inst.release,
  }))
}
