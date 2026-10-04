import * as Tone from 'tone'
import type { ParamValues } from '../../model/project'
import { applyMacros, BUILDER_DEFAULTS, BUILDER_PARAMS } from './builderParams'
import type { InstrumentDefinition, InstrumentVoice } from './types'

// Construtor de timbres: pool próprio de vozes (em vez de PolySynth, que exige uma
// classe Monophonic) com 2 osciladores + sub + ruído -> filtro 24 dB com envelope ->
// envelope de volume. Efeitos e LFOs são compartilhados por todas as vozes.
//
// Atenção (Tone.js):
// - Conectar um sinal a um Param ZERA o valor dele. Por isso a afinação base de cada
//   oscilador é um Tone.Signal próprio conectado ao detune, somado ao LFO de vibrato
//   (conexões de áudio somam). O mesmo vale para o corte do filtro (envelope + LFO).
// - Todos os nós recebem `context` explícito: vozes e reverb são criados sob demanda, e na
//   exportação isso acontece durante a renderização, quando o contexto global do Tone já
//   voltou a ser o ao vivo.
//
// Desempenho (medido na exportação): vozes são criadas sob demanda (até MAX_VOICES), efeitos
// com volume zero ficam fora da cadeia (não são processados) e o reverb por convolução só é
// criado quando usado. Antes disso o construtor custava ~2,6 s de CPU por 5 s de áudio parado.

const MAX_VOICES = 12
const n = (v: unknown) => Number(v)

type Wave = 'sine' | 'triangle' | 'square' | 'sawtooth'
type Ctx = Tone.BaseContext

class BuilderVoice {
  readonly o1: Tone.OmniOscillator<any>
  readonly o2: Tone.OmniOscillator<any>
  readonly sub: Tone.Oscillator
  readonly noise: Tone.Noise
  readonly g1: Tone.Gain
  readonly g2: Tone.Gain
  readonly gSub: Tone.Gain
  readonly gNoise: Tone.Gain
  readonly d1: Tone.Signal
  readonly d2: Tone.Signal
  readonly dSub: Tone.Signal
  readonly filter: Tone.Filter
  readonly fenv: Tone.FrequencyEnvelope
  readonly amp: Tone.AmplitudeEnvelope
  busyUntil = 0

  constructor(context: Ctx, out: Tone.InputNode, vibrato: Tone.LFO, filterLfo: Tone.LFO) {
    this.o1 = new Tone.OmniOscillator({ context })
    this.o2 = new Tone.OmniOscillator({ context })
    this.sub = new Tone.Oscillator({ context, type: 'sine' })
    this.noise = new Tone.Noise({ context, type: 'white' })
    this.g1 = new Tone.Gain({ context, gain: 0 })
    this.g2 = new Tone.Gain({ context, gain: 0 })
    this.gSub = new Tone.Gain({ context, gain: 0 })
    this.gNoise = new Tone.Gain({ context, gain: 0 })
    this.d1 = new Tone.Signal({ context, value: 0 })
    this.d2 = new Tone.Signal({ context, value: 0 })
    this.dSub = new Tone.Signal({ context, value: 0 })
    this.filter = new Tone.Filter({ context, type: 'lowpass', rolloff: -24, frequency: 0 })
    this.fenv = new Tone.FrequencyEnvelope({ context })
    this.amp = new Tone.AmplitudeEnvelope({ context })

    this.o1.chain(this.g1, this.filter)
    this.o2.chain(this.g2, this.filter)
    this.sub.chain(this.gSub, this.filter)
    this.noise.chain(this.gNoise, this.filter)
    this.d1.connect(this.o1.detune)
    this.d2.connect(this.o2.detune)
    this.dSub.connect(this.sub.detune)
    for (const osc of [this.o1, this.o2, this.sub]) vibrato.connect(osc.detune)
    this.fenv.connect(this.filter.frequency)
    filterLfo.connect(this.filter.frequency)
    this.filter.chain(this.amp)
    this.amp.connect(out)
  }

  get sources() {
    return [
      { src: this.o1, gain: this.g1 },
      { src: this.o2, gain: this.g2 },
      { src: this.sub, gain: this.gSub },
      { src: this.noise, gain: this.gNoise },
    ]
  }

  /** Aplica os parâmetros efetivos (já com macros) a esta voz. */
  apply(p: ParamValues) {
    setOscillator(this.o1, p.osc1Wave as Wave, n(p.osc1Unison), n(p.osc1Spread))
    setOscillator(this.o2, p.osc2Wave as Wave, n(p.osc2Unison), n(p.osc2Spread))
    this.sub.type = p.subWave as 'sine' | 'square'
    this.noise.type = p.noiseColor as 'white' | 'pink'
    this.g1.gain.value = n(p.osc1Level)
    this.g2.gain.value = n(p.osc2Level)
    this.gSub.gain.value = n(p.subLevel)
    this.gNoise.gain.value = n(p.noiseLevel) * 0.5
    this.d1.value = n(p.osc1Octave) * 1200 + n(p.osc1Semi) * 100 + n(p.osc1Fine)
    this.d2.value = n(p.osc2Octave) * 1200 + n(p.osc2Semi) * 100 + n(p.osc2Fine)
    this.dSub.value = n(p.osc1Octave) * 1200 - 1200 // uma oitava abaixo do oscilador 1
    this.filter.set({ type: p.filterType as BiquadFilterType, Q: n(p.resonance) })
    this.fenv.baseFrequency = n(p.cutoff)
    this.fenv.octaves = n(p.filterEnv)
    this.fenv.set({ attack: n(p.fAttack), decay: n(p.fDecay), sustain: n(p.fSustain), release: n(p.fRelease) })
    this.amp.set({ attack: n(p.attack), decay: n(p.decay), sustain: n(p.sustain), release: n(p.release) })
  }

  dispose() {
    for (const node of [
      this.o1, this.o2, this.sub, this.noise, this.g1, this.g2, this.gSub, this.gNoise,
      this.d1, this.d2, this.dSub, this.filter, this.fenv, this.amp,
    ]) node.dispose()
  }
}

function setOscillator(osc: Tone.OmniOscillator<any>, wave: Wave, unison: number, spread: number) {
  if (unison > 1) {
    const type = `fat${wave}` as const
    if (osc.type !== type) osc.type = type
    osc.set({ count: unison, spread } as any)
  } else if (osc.type !== wave) {
    osc.type = wave
  }
}

/** Tamanho da sala (0,1..0,95) -> duração do reverb em segundos. */
const reverbDecay = (size: number) => 0.3 + size * 4

function createBuilder(output: Tone.InputNode, params: ParamValues): InstrumentVoice {
  const context = Tone.getContext()
  const volume = new Tone.Volume({ context, volume: 0 }).connect(output)
  const delay = new Tone.FeedbackDelay({ context, delayTime: 0.3, feedback: 0.35, wet: 0 })
  const tremolo = new Tone.Tremolo({ context, frequency: 5, depth: 0, spread: 0 }).start()
  const chorus = new Tone.Chorus({ context, frequency: 1.5, delayTime: 3.5, depth: 0.7, wet: 0 }).start()
  const distortion = new Tone.Distortion({ context, distortion: 0, wet: 1, oversample: '2x' })
  const bus = new Tone.Gain({ context, gain: 0.25 })
  const vibrato = new Tone.LFO({ context, frequency: 5, min: 0, max: 0 }).start()
  const filterLfo = new Tone.LFO({ context, frequency: 5, min: 0, max: 0 }).start()
  const voices: BuilderVoice[] = []
  let reverb: Tone.Reverb | null = null
  let decay = 0
  let regenTimer: ReturnType<typeof setTimeout> | undefined
  let wiring: string | null = null // null = nunca ligado (força a primeira ligação)
  let p = applyMacros({ ...BUILDER_DEFAULTS, ...params })

  /** Liga em série só os efeitos em uso: vozes -> [distorção, chorus, tremolo, delay, reverb] -> volume. */
  const rewire = () => {
    const chain: Tone.ToneAudioNode[] = []
    if (n(p.drive) > 0) chain.push(distortion)
    if (n(p.chorus) > 0) chain.push(chorus)
    if (n(p.tremolo) > 0) chain.push(tremolo)
    if (n(p.delayMix) > 0) chain.push(delay)
    if (n(p.reverbMix) > 0 && reverb) chain.push(reverb)
    const key = chain.map((node) => node.name).join('>')
    if (key === wiring) return
    wiring = key
    for (const node of [bus, distortion, chorus, tremolo, delay, reverb]) node?.disconnect()
    let prev: Tone.ToneAudioNode = bus
    for (const node of chain) {
      prev.connect(node)
      prev = node
    }
    prev.connect(volume)
  }

  /** Cria (ou ajusta) o reverb quando ele passa a ser usado. */
  const ensureReverb = (): Promise<unknown> => {
    const nextDecay = reverbDecay(n(p.reverbSize))
    if (!reverb) {
      decay = nextDecay
      reverb = new Tone.Reverb({ context, decay, preDelay: 0.01, wet: n(p.reverbMix) })
      const created = reverb
      // Só entra na cadeia depois de gerar a resposta da sala (antes disso soaria seco/vazio).
      return created.ready.then(() => {
        if (reverb === created) {
          wiring = null
          rewire()
        }
      })
    }
    if (Math.abs(nextDecay - decay) > 0.05) {
      // Regerar a resposta é caro: só quando o tamanho muda, e com atraso (slider).
      decay = nextDecay
      clearTimeout(regenTimer)
      regenTimer = setTimeout(() => {
        if (reverb) reverb.decay = decay
      }, 250)
    }
    return Promise.resolve()
  }

  let reverbReady: Promise<unknown> = Promise.resolve()

  const setParams = (raw: ParamValues) => {
    p = applyMacros({ ...BUILDER_DEFAULTS, ...raw })
    for (const v of voices) v.apply(p)
    vibrato.set({ type: p.lfoWave as Wave, frequency: n(p.lfoRate), min: -n(p.vibrato), max: n(p.vibrato) })
    const lfoHz = n(p.lfoFilter) * n(p.cutoff)
    filterLfo.set({ type: p.lfoWave as Wave, frequency: n(p.lfoRate), min: -lfoHz, max: lfoHz })
    tremolo.set({ frequency: n(p.lfoRate), depth: n(p.tremolo) })
    distortion.distortion = n(p.drive)
    chorus.wet.value = n(p.chorus)
    delay.set({ delayTime: n(p.delayTime), feedback: n(p.delayFeedback) })
    delay.wet.value = n(p.delayMix)
    if (n(p.reverbMix) > 0) reverbReady = ensureReverb()
    if (reverb) reverb.wet.value = n(p.reverbMix)
    // Distorção soma volume; compensa um pouco para não estourar ao aumentá-la.
    volume.volume.value = n(p.gain) - n(p.drive) * 8
    rewire()
  }
  setParams(params)

  /** Voz livre; senão cria uma nova (até o limite); senão reaproveita a que termina primeiro. */
  const allocate = (time: number): BuilderVoice => {
    let free: BuilderVoice | undefined
    let earliest: BuilderVoice | undefined
    for (const v of voices) {
      if (v.busyUntil <= time && (!free || v.busyUntil < free.busyUntil)) free = v
      if (!earliest || v.busyUntil < earliest.busyUntil) earliest = v
    }
    if (free) return free
    if (voices.length < MAX_VOICES || !earliest) {
      const v = new BuilderVoice(context, bus, vibrato, filterLfo)
      v.apply(p)
      voices.push(v)
      return v
    }
    return earliest
  }

  return {
    // A exportação espera a resposta do reverb (gerada de forma assíncrona) antes de renderizar.
    get ready() {
      return reverbReady.then(() => undefined)
    },
    trigger: (pitch, time, duration, velocity) => {
      const v = allocate(time)
      const hz = Tone.Frequency(pitch, 'midi').toFrequency()
      const end = time + duration + n(p.release) + 0.05
      for (const { src, gain } of v.sources) {
        if (gain.gain.value <= 0) continue // desligado: nem inicia (economiza CPU)
        if ('frequency' in src) src.frequency.setValueAtTime(hz, time)
        try {
          src.start(time) // se já estiver tocando (voz reaproveitada), o Tone reinicia e cancela a parada antiga
          src.stop(end)
        } catch {
          // dois inícios no mesmo instante na mesma voz: ignora esta fonte
        }
      }
      v.fenv.triggerAttackRelease(duration, time)
      v.amp.triggerAttackRelease(duration, time, velocity)
      v.busyUntil = end
    },
    setParams,
    releaseAll: () => {
      const now = context.currentTime
      for (const v of voices) {
        v.amp.triggerRelease(now)
        v.fenv.triggerRelease(now)
        v.busyUntil = now
      }
    },
    dispose: () => {
      clearTimeout(regenTimer)
      voices.forEach((v) => v.dispose())
      for (const node of [vibrato, filterLfo, bus, distortion, chorus, tremolo, delay, reverb, volume]) node?.dispose()
    },
  }
}

export const BUILDER_INSTRUMENT: InstrumentDefinition = {
  id: 'builder',
  name: 'Construtor (criar timbre)',
  category: 'Sintetizador',
  params: BUILDER_PARAMS,
  defaults: BUILDER_DEFAULTS,
  focusPitch: 60,
  editor: 'builder',
  create: createBuilder,
}
