import * as Tone from 'tone'
import type { ParamValues } from '../../model/project'
import type { InstrumentDefinition, InstrumentVoice, ParamSpec } from './types'

const n = (v: unknown) => Number(v)
const midiToHz = (pitch: number) => Tone.Frequency(pitch, 'midi').toFrequency()

const ENVELOPE_PARAMS: ParamSpec[] = [
  { key: 'attack', label: 'Ataque', group: 'Envelope', type: 'number', min: 0.001, max: 4, step: 0.001, unit: 's', log: true },
  { key: 'decay', label: 'Decaimento', group: 'Envelope', type: 'number', min: 0.01, max: 4, step: 0.01, unit: 's', log: true },
  { key: 'sustain', label: 'Sustentação', group: 'Envelope', type: 'number', min: 0, max: 1, step: 0.01 },
  { key: 'release', label: 'Liberação', group: 'Envelope', type: 'number', min: 0.01, max: 8, step: 0.01, unit: 's', log: true },
]

const FILTER_PARAMS: ParamSpec[] = [
  {
    key: 'filterType',
    label: 'Tipo',
    group: 'Filtro',
    type: 'select',
    options: [
      { value: 'lowpass', label: 'Passa-baixa' },
      { value: 'highpass', label: 'Passa-alta' },
      { value: 'bandpass', label: 'Passa-banda' },
    ],
  },
  { key: 'cutoff', label: 'Corte', group: 'Filtro', type: 'number', min: 40, max: 18000, step: 1, unit: 'Hz', log: true },
  { key: 'resonance', label: 'Ressonância', group: 'Filtro', type: 'number', min: 0.1, max: 20, step: 0.1 },
]

const OCTAVE_PARAM: ParamSpec = { key: 'octave', label: 'Oitava', group: 'Oscilador', type: 'number', min: -3, max: 3, step: 1 }

// ---------- Sintetizador subtrativo (osciladores -> filtro) ----------

const ORGAN_PARTIALS = [1, 0.7, 0.45, 0, 0.3, 0, 0.18, 0.12]

function oscillatorOptions(p: ParamValues): Record<string, unknown> {
  const type = String(p.waveform)
  if (type === 'organ') return { type: 'custom', partials: ORGAN_PARTIALS }
  if (type.startsWith('fat')) return { type, count: 3, spread: n(p.spread) }
  return { type }
}

const SUBTRACTIVE_PARAMS: ParamSpec[] = [
  {
    key: 'waveform',
    label: 'Forma de onda',
    group: 'Oscilador',
    type: 'select',
    options: [
      { value: 'sine', label: 'Senoidal' },
      { value: 'triangle', label: 'Triangular' },
      { value: 'square', label: 'Quadrada' },
      { value: 'sawtooth', label: 'Dente de serra' },
      { value: 'fatsawtooth', label: 'Dente de serra encorpada' },
      { value: 'fatsquare', label: 'Quadrada encorpada' },
      { value: 'organ', label: 'Órgão (harmônicos)' },
    ],
  },
  { key: 'spread', label: 'Espalhamento (encorpada)', group: 'Oscilador', type: 'number', min: 0, max: 80, step: 1, unit: 'cents' },
  OCTAVE_PARAM,
  ...ENVELOPE_PARAMS,
  ...FILTER_PARAMS,
]

function createSubtractive(output: Tone.InputNode, params: ParamValues): InstrumentVoice {
  const filter = new Tone.Filter({ type: 'lowpass', frequency: 4000, Q: 1 }).connect(output)
  const synth = new Tone.PolySynth({ voice: Tone.Synth, maxPolyphony: 32 }).connect(filter)
  synth.volume.value = -10
  let octave = 0

  const setParams = (p: ParamValues) => {
    octave = n(p.octave)
    synth.set({
      oscillator: oscillatorOptions(p) as any,
      envelope: { attack: n(p.attack), decay: n(p.decay), sustain: n(p.sustain), release: n(p.release) },
    })
    filter.set({ type: String(p.filterType) as BiquadFilterType, frequency: n(p.cutoff), Q: n(p.resonance) })
  }
  setParams(params)

  return {
    ready: Promise.resolve(),
    trigger: (pitch, time, duration, velocity) =>
      synth.triggerAttackRelease(midiToHz(pitch + octave * 12), duration, time, velocity),
    setParams,
    releaseAll: () => synth.releaseAll(),
    dispose: () => {
      synth.dispose()
      filter.dispose()
    },
  }
}

function subtractive(id: string, name: string, focusPitch: number, defaults: ParamValues): InstrumentDefinition {
  return { id, name, category: 'Sintetizador', params: SUBTRACTIVE_PARAMS, defaults, focusPitch, create: createSubtractive }
}

// ---------- Sintetizador FM (piano elétrico, sinos) ----------

const FM_PARAMS: ParamSpec[] = [
  { key: 'harmonicity', label: 'Harmonicidade', group: 'FM', type: 'number', min: 0.5, max: 8, step: 0.01 },
  { key: 'modulationIndex', label: 'Índice de modulação', group: 'FM', type: 'number', min: 0, max: 40, step: 0.1 },
  { key: 'brightnessDecay', label: 'Queda do brilho', group: 'FM', type: 'number', min: 0.01, max: 4, step: 0.01, unit: 's', log: true },
  OCTAVE_PARAM,
  ...ENVELOPE_PARAMS,
  ...FILTER_PARAMS,
]

function createFm(output: Tone.InputNode, params: ParamValues): InstrumentVoice {
  const filter = new Tone.Filter({ type: 'lowpass', frequency: 8000, Q: 1 }).connect(output)
  const synth = new Tone.PolySynth({ voice: Tone.FMSynth, maxPolyphony: 32 }).connect(filter)
  synth.volume.value = -8
  let octave = 0

  const setParams = (p: ParamValues) => {
    octave = n(p.octave)
    synth.set({
      harmonicity: n(p.harmonicity),
      modulationIndex: n(p.modulationIndex),
      envelope: { attack: n(p.attack), decay: n(p.decay), sustain: n(p.sustain), release: n(p.release) },
      modulationEnvelope: { attack: 0.002, decay: n(p.brightnessDecay), sustain: 0, release: n(p.release) },
    })
    filter.set({ type: String(p.filterType) as BiquadFilterType, frequency: n(p.cutoff), Q: n(p.resonance) })
  }
  setParams(params)

  return {
    ready: Promise.resolve(),
    trigger: (pitch, time, duration, velocity) =>
      synth.triggerAttackRelease(midiToHz(pitch + octave * 12), duration, time, velocity),
    setParams,
    releaseAll: () => synth.releaseAll(),
    dispose: () => {
      synth.dispose()
      filter.dispose()
    },
  }
}

function fm(id: string, name: string, focusPitch: number, defaults: ParamValues): InstrumentDefinition {
  return { id, name, category: 'Sintetizador', params: FM_PARAMS, defaults, focusPitch, create: createFm }
}

// ---------- Bateria sintetizada ----------

export const DRUM_PITCHES = {
  kick: 36,
  snare: 38,
  clap: 39,
  closedHat: 42,
  openHat: 46,
  lowTom: 41,
  midTom: 45,
  highTom: 48,
  crash: 49,
} as const

const DRUM_LABELS: Record<number, string> = {
  36: 'Bumbo',
  38: 'Caixa',
  39: 'Palmas',
  41: 'Tom grave',
  42: 'Chimbal fechado',
  45: 'Tom médio',
  46: 'Chimbal aberto',
  48: 'Tom agudo',
  49: 'Prato',
}

const DRUM_PARAMS: ParamSpec[] = [
  { key: 'kickTune', label: 'Afinação', group: 'Bumbo', type: 'number', min: -12, max: 12, step: 1, unit: 'st' },
  { key: 'kickDecay', label: 'Decaimento', group: 'Bumbo', type: 'number', min: 0.1, max: 1.5, step: 0.01, unit: 's' },
  { key: 'kickPunch', label: 'Punch', group: 'Bumbo', type: 'number', min: 0.005, max: 0.2, step: 0.001, unit: 's', log: true },
  { key: 'snareDecay', label: 'Decaimento', group: 'Caixa / Palmas', type: 'number', min: 0.05, max: 0.6, step: 0.01, unit: 's' },
  { key: 'snareTone', label: 'Brilho', group: 'Caixa / Palmas', type: 'number', min: 300, max: 8000, step: 1, unit: 'Hz', log: true },
  { key: 'hatDecay', label: 'Decaimento', group: 'Pratos', type: 'number', min: 0.02, max: 0.4, step: 0.005, unit: 's' },
  { key: 'tomTune', label: 'Afinação', group: 'Tons', type: 'number', min: -12, max: 12, step: 1, unit: 'st' },
]

function createDrums(output: Tone.InputNode, params: ParamValues): InstrumentVoice {
  const bus = new Tone.Gain(1).connect(output)
  const kick = new Tone.MembraneSynth({ octaves: 6, volume: -4 }).connect(bus)
  const snareFilter = new Tone.Filter({ type: 'highpass', frequency: 1500 }).connect(bus)
  const snareNoise = new Tone.NoiseSynth({ noise: { type: 'white' }, volume: -12 }).connect(snareFilter)
  const snareBody = new Tone.MembraneSynth({ octaves: 2, volume: -14 }).connect(bus)
  const clapFilter = new Tone.Filter({ type: 'bandpass', frequency: 1200, Q: 1.5 }).connect(bus)
  const clap = new Tone.NoiseSynth({ noise: { type: 'pink' }, volume: -6 }).connect(clapFilter)
  // Pratos com ruído filtrado (estilo TR-808/909). O MetalSynth do Tone soava bem, mas
  // custava ~65 ms por nota na exportação offline.
  const hatFilter = new Tone.Filter({ type: 'highpass', frequency: 7000, Q: 0.8 }).connect(bus)
  const closedHat = new Tone.NoiseSynth({ noise: { type: 'white' }, volume: -14 }).connect(hatFilter)
  const openHat = new Tone.NoiseSynth({ noise: { type: 'white' }, volume: -16 }).connect(hatFilter)
  const crashFilter = new Tone.Filter({ type: 'highpass', frequency: 4500, Q: 0.5 }).connect(bus)
  const crash = new Tone.NoiseSynth({
    noise: { type: 'white' },
    volume: -16,
    envelope: { attack: 0.002, decay: 1.6, sustain: 0 },
  }).connect(crashFilter)
  const tom = new Tone.PolySynth({ voice: Tone.MembraneSynth, options: { octaves: 2.5, volume: -6 } }).connect(bus)

  let p = params
  const setParams = (next: ParamValues) => {
    p = next
    kick.set({ pitchDecay: n(p.kickPunch), envelope: { attack: 0.001, decay: n(p.kickDecay), sustain: 0, release: 0.1 } })
    snareNoise.set({ envelope: { attack: 0.001, decay: n(p.snareDecay), sustain: 0 } })
    snareBody.set({ envelope: { attack: 0.001, decay: n(p.snareDecay) * 0.6, sustain: 0 } })
    snareFilter.frequency.value = n(p.snareTone)
    clap.set({ envelope: { attack: 0.005, decay: n(p.snareDecay) * 0.8, sustain: 0 } })
    closedHat.set({ envelope: { attack: 0.001, decay: n(p.hatDecay), sustain: 0 } })
    openHat.set({ envelope: { attack: 0.001, decay: n(p.hatDecay) * 5, sustain: 0 } })
    tom.set({ envelope: { attack: 0.001, decay: 0.45, sustain: 0, release: 0.2 } })
  }
  setParams(params)

  const all = [kick, snareFilter, snareNoise, snareBody, clapFilter, clap, hatFilter, closedHat, openHat, crashFilter, crash, tom, bus]

  return {
    ready: Promise.resolve(),
    trigger: (pitch, time, _duration, velocity) => {
      switch (pitch) {
        case DRUM_PITCHES.kick:
          kick.triggerAttackRelease(midiToHz(24 + n(p.kickTune)), 0.1, time, velocity)
          break
        case DRUM_PITCHES.snare:
          snareNoise.triggerAttackRelease(0.1, time, velocity)
          snareBody.triggerAttackRelease(185, 0.05, time, velocity)
          break
        case DRUM_PITCHES.clap:
          clap.triggerAttackRelease(0.1, time, velocity)
          break
        case DRUM_PITCHES.closedHat:
          openHat.triggerRelease(time) // chimbal fechado "corta" o aberto
          closedHat.triggerAttackRelease(0.05, time, velocity)
          break
        case DRUM_PITCHES.openHat:
          openHat.triggerAttackRelease(0.3, time, velocity)
          break
        case DRUM_PITCHES.crash:
          crash.triggerAttackRelease(0.5, time, velocity)
          break
        case DRUM_PITCHES.lowTom:
        case DRUM_PITCHES.midTom:
        case DRUM_PITCHES.highTom: {
          const base = pitch === DRUM_PITCHES.lowTom ? 41 : pitch === DRUM_PITCHES.midTom ? 45 : 50
          tom.triggerAttackRelease(midiToHz(base + n(p.tomTune)), 0.2, time, velocity)
          break
        }
      }
    },
    setParams,
    releaseAll: () => tom.releaseAll(),
    dispose: () => all.forEach((node) => node.dispose()),
  }
}

// ---------- Catálogo ----------

export const SYNTH_INSTRUMENTS: InstrumentDefinition[] = [
  subtractive('lead', 'Lead', 72, {
    waveform: 'sawtooth', spread: 20, octave: 0,
    attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.3,
    filterType: 'lowpass', cutoff: 4000, resonance: 2,
  }),
  subtractive('synth-bass', 'Baixo sintetizado', 40, {
    waveform: 'square', spread: 20, octave: 0,
    attack: 0.005, decay: 0.25, sustain: 0.4, release: 0.15,
    filterType: 'lowpass', cutoff: 700, resonance: 6,
  }),
  subtractive('pad', 'Pad', 60, {
    waveform: 'fatsawtooth', spread: 30, octave: 0,
    attack: 0.8, decay: 1, sustain: 0.8, release: 2,
    filterType: 'lowpass', cutoff: 2200, resonance: 1,
  }),
  subtractive('organ', 'Órgão', 60, {
    waveform: 'organ', spread: 20, octave: 0,
    attack: 0.01, decay: 0.1, sustain: 1, release: 0.1,
    filterType: 'lowpass', cutoff: 8000, resonance: 0.5,
  }),
  subtractive('pluck', 'Pluck', 67, {
    waveform: 'triangle', spread: 20, octave: 0,
    attack: 0.002, decay: 0.3, sustain: 0, release: 0.3,
    filterType: 'lowpass', cutoff: 3000, resonance: 3,
  }),
  fm('epiano', 'Piano elétrico', 60, {
    harmonicity: 3, modulationIndex: 10, brightnessDecay: 0.4, octave: 0,
    attack: 0.005, decay: 1.2, sustain: 0.2, release: 1,
    filterType: 'lowpass', cutoff: 9000, resonance: 0.5,
  }),
  fm('bell', 'Sino', 72, {
    harmonicity: 3.5, modulationIndex: 20, brightnessDecay: 1.5, octave: 0,
    attack: 0.001, decay: 2.5, sustain: 0, release: 2.5,
    filterType: 'lowpass', cutoff: 12000, resonance: 0.5,
  }),
  {
    id: 'drums',
    name: 'Bateria sintetizada',
    category: 'Bateria',
    params: DRUM_PARAMS,
    defaults: { kickTune: 0, kickDecay: 0.5, kickPunch: 0.05, snareDecay: 0.2, snareTone: 1500, hatDecay: 0.05, tomTune: 0 },
    focusPitch: 42,
    pitchLabels: DRUM_LABELS,
    create: createDrums,
  },
]
