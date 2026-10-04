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
  FILTER_PARAMS[0],
  FILTER_PARAMS[1],
  { key: 'resonance', label: 'Ressonância', group: 'Filtro', type: 'number', min: 0.1, max: 12, step: 0.1 },
  { key: 'filterEnvAmount', label: 'Abertura pelo envelope', group: 'Filtro', type: 'number', min: 0, max: 6, step: 0.1, unit: 'oit' },
  { key: 'filterDecay', label: 'Fechamento do filtro', group: 'Filtro', type: 'number', min: 0.01, max: 4, step: 0.01, unit: 's', log: true },
]

/**
 * Subtrativo com um filtro 24 dB/oitava POR NOTA (Tone.MonoSynth), com envelope
 * próprio: cada nota começa mais brilhante e fecha. A primeira versão usava um
 * filtro único 12 dB/oit. com ressonância fixa em 4 kHz, que deixava as notas
 * agudas do dente de serra com chiado.
 */
function createSubtractive(output: Tone.InputNode, params: ParamValues): InstrumentVoice {
  const synth = new Tone.PolySynth({ voice: Tone.MonoSynth, maxPolyphony: 24 }).connect(output)
  synth.volume.value = -6
  let octave = 0

  const setParams = (p: ParamValues) => {
    octave = n(p.octave)
    synth.set({
      oscillator: oscillatorOptions(p) as any,
      envelope: { attack: n(p.attack), decay: n(p.decay), sustain: n(p.sustain), release: n(p.release) },
      filter: { type: String(p.filterType) as BiquadFilterType, Q: n(p.resonance), rolloff: -24 },
      filterEnvelope: {
        attack: n(p.attack),
        decay: n(p.filterDecay),
        sustain: 0.25,
        release: n(p.release),
        baseFrequency: n(p.cutoff),
        octaves: n(p.filterEnvAmount),
      },
    })
  }
  setParams(params)

  return {
    ready: Promise.resolve(),
    trigger: (pitch, time, duration, velocity) =>
      synth.triggerAttackRelease(midiToHz(pitch + octave * 12), duration, time, velocity),
    setParams,
    releaseAll: () => synth.releaseAll(),
    dispose: () => synth.dispose(),
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

// Notas no padrão General MIDI de percussão (facilita importar/exportar MIDI no futuro).
export const DRUM_PITCHES = {
  kick: 36,
  rim: 37,
  snare: 38,
  clap: 39,
  closedHat: 42,
  openHat: 46,
  lowTom: 41,
  midTom: 45,
  highTom: 48,
  crash: 49,
  ride: 51,
  cowbell: 56,
} as const

const DRUM_LABELS: Record<number, string> = {
  36: 'Bumbo',
  37: 'Aro',
  38: 'Caixa',
  39: 'Palmas',
  41: 'Tom grave',
  42: 'Chimbal fechado',
  45: 'Tom médio',
  46: 'Chimbal aberto',
  48: 'Tom agudo',
  49: 'Prato',
  51: 'Condução',
  56: 'Cowbell',
}

/** Ordem das linhas no editor de bateria (de cima para baixo). */
const DRUM_ROWS = [49, 51, 46, 42, 56, 48, 45, 41, 39, 37, 38, 36]

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
  const rideFilter = new Tone.Filter({ type: 'highpass', frequency: 6000, Q: 0.7 }).connect(bus)
  const ride = new Tone.NoiseSynth({ noise: { type: 'white' }, volume: -20, envelope: { attack: 0.001, decay: 0.9, sustain: 0 } }).connect(rideFilter)
  const rimFilter = new Tone.Filter({ type: 'bandpass', frequency: 1800, Q: 2 }).connect(bus)
  const rim = new Tone.MembraneSynth({ octaves: 1, volume: 8, envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 } }).connect(rimFilter)
  // Cowbell clássico (TR-808): duas ondas quadradas desafinadas num passa-banda.
  const cowbellFilter = new Tone.Filter({ type: 'bandpass', frequency: 800, Q: 3 }).connect(bus)
  const cowbellEnv = { attack: 0.001, decay: 0.25, sustain: 0, release: 0.05 }
  const cowbellA = new Tone.Synth({ oscillator: { type: 'square' }, envelope: cowbellEnv, volume: -16 }).connect(cowbellFilter)
  const cowbellB = new Tone.Synth({ oscillator: { type: 'square' }, envelope: cowbellEnv, volume: -16 }).connect(cowbellFilter)

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

  const all = [
    kick, snareFilter, snareNoise, snareBody, clapFilter, clap, hatFilter, closedHat, openHat, crashFilter, crash, tom,
    rideFilter, ride, rimFilter, rim, cowbellFilter, cowbellA, cowbellB, bus,
  ]

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
        case DRUM_PITCHES.ride:
          ride.triggerAttackRelease(0.3, time, velocity)
          break
        case DRUM_PITCHES.rim:
          rim.triggerAttackRelease(420, 0.03, time, velocity)
          break
        case DRUM_PITCHES.cowbell:
          cowbellA.triggerAttackRelease(540, 0.1, time, velocity)
          cowbellB.triggerAttackRelease(800, 0.1, time, velocity)
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
    waveform: 'fatsawtooth', spread: 12, octave: 0,
    attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.25,
    filterType: 'lowpass', cutoff: 1400, resonance: 1.5, filterEnvAmount: 2.5, filterDecay: 0.35,
  }),
  subtractive('synth-bass', 'Baixo sintetizado', 40, {
    waveform: 'square', spread: 20, octave: 0,
    attack: 0.005, decay: 0.25, sustain: 0.5, release: 0.12,
    filterType: 'lowpass', cutoff: 220, resonance: 3, filterEnvAmount: 3, filterDecay: 0.22,
  }),
  subtractive('pad', 'Pad', 60, {
    waveform: 'fatsawtooth', spread: 30, octave: 0,
    attack: 0.8, decay: 1, sustain: 0.8, release: 2,
    filterType: 'lowpass', cutoff: 700, resonance: 1, filterEnvAmount: 2, filterDecay: 1.8,
  }),
  subtractive('organ', 'Órgão', 60, {
    waveform: 'organ', spread: 20, octave: 0,
    attack: 0.01, decay: 0.1, sustain: 1, release: 0.1,
    filterType: 'lowpass', cutoff: 6000, resonance: 0.5, filterEnvAmount: 0, filterDecay: 0.1,
  }),
  subtractive('pluck', 'Pluck', 67, {
    waveform: 'sawtooth', spread: 20, octave: 0,
    attack: 0.002, decay: 0.35, sustain: 0, release: 0.3,
    filterType: 'lowpass', cutoff: 500, resonance: 2, filterEnvAmount: 3.5, filterDecay: 0.18,
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
    rows: DRUM_ROWS,
    create: createDrums,
  },
]
