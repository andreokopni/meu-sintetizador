// Parâmetros, modelos e macros do Construtor de timbres. Sem Tone.js (testável e
// legível por uma IA: cada parâmetro tem rótulo, faixa e unidade).

import type { ParamValues } from '../../model/project'
import type { ParamSpec } from './types'

const WAVES = [
  { value: 'sine', label: 'Senoidal' },
  { value: 'triangle', label: 'Triangular' },
  { value: 'square', label: 'Quadrada' },
  { value: 'sawtooth', label: 'Dente de serra' },
]

function oscParams(n: 1 | 2): ParamSpec[] {
  const group = `Oscilador ${n}`
  const k = (s: string) => `osc${n}${s}`
  return [
    { key: k('Wave'), label: 'Forma de onda', group, type: 'select', options: WAVES },
    { key: k('Level'), label: 'Volume', group, type: 'number', min: 0, max: 1, step: 0.01 },
    { key: k('Octave'), label: 'Oitava', group, type: 'number', min: -2, max: 2, step: 1 },
    { key: k('Semi'), label: 'Semitons', group, type: 'number', min: -12, max: 12, step: 1, unit: 'st' },
    { key: k('Fine'), label: 'Ajuste fino', group, type: 'number', min: -50, max: 50, step: 1, unit: 'cents' },
    { key: k('Unison'), label: 'Uníssono (vozes)', group, type: 'number', min: 1, max: 7, step: 1 },
    { key: k('Spread'), label: 'Abertura do uníssono', group, type: 'number', min: 0, max: 60, step: 1, unit: 'cents' },
  ]
}

const ADSR = (group: string, prefix: string): ParamSpec[] => {
  const k = (s: string) => (prefix ? `${prefix}${s}` : s.toLowerCase())
  return [
    { key: k('Attack'), label: 'Ataque', group, type: 'number', min: 0.001, max: 5, step: 0.001, unit: 's', log: true },
    { key: k('Decay'), label: 'Decaimento', group, type: 'number', min: 0.01, max: 5, step: 0.01, unit: 's', log: true },
    { key: k('Sustain'), label: 'Sustentação', group, type: 'number', min: 0, max: 1, step: 0.01 },
    { key: k('Release'), label: 'Liberação', group, type: 'number', min: 0.01, max: 8, step: 0.01, unit: 's', log: true },
  ]
}

export const BUILDER_PARAMS: ParamSpec[] = [
  // Macros: aparecem no painel lateral; cada um mexe em vários parâmetros (ver applyMacros).
  { key: 'mBright', label: 'Brilho', group: 'Macros', type: 'number', min: 0, max: 1, step: 0.01 },
  { key: 'mAttack', label: 'Suavidade', group: 'Macros', type: 'number', min: 0, max: 1, step: 0.01 },
  { key: 'mSpace', label: 'Espaço', group: 'Macros', type: 'number', min: 0, max: 1, step: 0.01 },
  { key: 'mMotion', label: 'Movimento', group: 'Macros', type: 'number', min: 0, max: 1, step: 0.01 },
  ...oscParams(1),
  ...oscParams(2),
  { key: 'subLevel', label: 'Sub-oscilador', group: 'Sub e ruído', type: 'number', min: 0, max: 1, step: 0.01 },
  {
    key: 'subWave', label: 'Forma do sub', group: 'Sub e ruído', type: 'select',
    options: [{ value: 'sine', label: 'Senoidal' }, { value: 'square', label: 'Quadrada' }],
  },
  { key: 'noiseLevel', label: 'Ruído', group: 'Sub e ruído', type: 'number', min: 0, max: 1, step: 0.01 },
  {
    key: 'noiseColor', label: 'Cor do ruído', group: 'Sub e ruído', type: 'select',
    options: [{ value: 'white', label: 'Branco (brilhante)' }, { value: 'pink', label: 'Rosa (suave)' }],
  },
  {
    key: 'filterType', label: 'Tipo', group: 'Filtro', type: 'select',
    options: [
      { value: 'lowpass', label: 'Passa-baixa' },
      { value: 'highpass', label: 'Passa-alta' },
      { value: 'bandpass', label: 'Passa-banda' },
    ],
  },
  { key: 'cutoff', label: 'Corte', group: 'Filtro', type: 'number', min: 40, max: 18000, step: 1, unit: 'Hz', log: true },
  { key: 'resonance', label: 'Ressonância', group: 'Filtro', type: 'number', min: 0.1, max: 12, step: 0.1 },
  { key: 'filterEnv', label: 'Abertura pelo envelope', group: 'Filtro', type: 'number', min: 0, max: 6, step: 0.1, unit: 'oit' },
  ...ADSR('Envelope do filtro', 'f'),
  ...ADSR('Envelope de volume', ''),
  {
    key: 'lfoWave', label: 'Forma', group: 'LFO', type: 'select',
    options: WAVES,
  },
  { key: 'lfoRate', label: 'Velocidade', group: 'LFO', type: 'number', min: 0.05, max: 20, step: 0.01, unit: 'Hz', log: true },
  { key: 'vibrato', label: 'Vibrato', group: 'LFO', type: 'number', min: 0, max: 100, step: 1, unit: 'cents' },
  { key: 'lfoFilter', label: 'No filtro', group: 'LFO', type: 'number', min: 0, max: 1, step: 0.01 },
  { key: 'tremolo', label: 'Tremolo', group: 'LFO', type: 'number', min: 0, max: 1, step: 0.01 },
  { key: 'drive', label: 'Distorção', group: 'Efeitos', type: 'number', min: 0, max: 1, step: 0.01 },
  { key: 'chorus', label: 'Chorus', group: 'Efeitos', type: 'number', min: 0, max: 1, step: 0.01 },
  { key: 'delayMix', label: 'Delay', group: 'Efeitos', type: 'number', min: 0, max: 1, step: 0.01 },
  { key: 'delayTime', label: 'Tempo do delay', group: 'Efeitos', type: 'number', min: 0.05, max: 1, step: 0.01, unit: 's', log: true },
  { key: 'delayFeedback', label: 'Repetições', group: 'Efeitos', type: 'number', min: 0, max: 0.9, step: 0.01 },
  { key: 'reverbMix', label: 'Reverb', group: 'Efeitos', type: 'number', min: 0, max: 1, step: 0.01 },
  { key: 'reverbSize', label: 'Tamanho da sala', group: 'Efeitos', type: 'number', min: 0.1, max: 0.95, step: 0.01 },
  { key: 'gain', label: 'Volume final', group: 'Saída', type: 'number', min: -24, max: 6, step: 0.5, unit: 'dB' },
]

/** Modelo "Básico": ponto de partida neutro (macros no meio = sem efeito). */
export const BUILDER_DEFAULTS: ParamValues = {
  mBright: 0.5, mAttack: 0.5, mSpace: 0.5, mMotion: 0.5,
  osc1Wave: 'sawtooth', osc1Level: 0.8, osc1Octave: 0, osc1Semi: 0, osc1Fine: 0, osc1Unison: 1, osc1Spread: 20,
  osc2Wave: 'square', osc2Level: 0, osc2Octave: 0, osc2Semi: 0, osc2Fine: 7, osc2Unison: 1, osc2Spread: 20,
  subLevel: 0, subWave: 'sine', noiseLevel: 0, noiseColor: 'white',
  filterType: 'lowpass', cutoff: 2000, resonance: 1, filterEnv: 1.5,
  fAttack: 0.005, fDecay: 0.4, fSustain: 0.3, fRelease: 0.4,
  attack: 0.005, decay: 0.3, sustain: 0.7, release: 0.3,
  lfoWave: 'sine', lfoRate: 5, vibrato: 0, lfoFilter: 0, tremolo: 0,
  drive: 0, chorus: 0, delayMix: 0, delayTime: 0.3, delayFeedback: 0.35, reverbMix: 0.1, reverbSize: 0.6,
  gain: 0,
}

export interface BuilderTemplate {
  id: string
  name: string
  params: ParamValues
}

const t = (id: string, name: string, params: ParamValues): BuilderTemplate => ({
  id, name, params: { ...BUILDER_DEFAULTS, ...params },
})

export const BUILDER_TEMPLATES: BuilderTemplate[] = [
  t('basic', 'Básico', {}),
  t('bass', 'Baixo', {
    osc1Wave: 'sawtooth', osc1Level: 0.7, subLevel: 0.6, subWave: 'sine',
    cutoff: 260, resonance: 3, filterEnv: 3, fDecay: 0.2, fSustain: 0.1,
    attack: 0.003, decay: 0.3, sustain: 0.6, release: 0.12, reverbMix: 0, gain: -3,
  }),
  t('lead', 'Lead', {
    osc1Wave: 'sawtooth', osc1Unison: 3, osc1Spread: 15, osc2Wave: 'square', osc2Level: 0.35, osc2Fine: 8,
    cutoff: 1500, resonance: 2, filterEnv: 2.5, fDecay: 0.35, vibrato: 12, lfoRate: 5.5,
    delayMix: 0.2, delayTime: 0.28, reverbMix: 0.15,
  }),
  t('pad', 'Pad', {
    osc1Wave: 'sawtooth', osc1Unison: 5, osc1Spread: 30, osc2Wave: 'triangle', osc2Level: 0.3, osc2Octave: 1,
    cutoff: 800, filterEnv: 1.5, fAttack: 1.2, fDecay: 2, fSustain: 0.5,
    attack: 0.9, decay: 1, sustain: 0.85, release: 2.2, lfoRate: 0.3, lfoFilter: 0.2,
    chorus: 0.4, reverbMix: 0.45, reverbSize: 0.85,
  }),
  t('pluck', 'Pluck', {
    osc1Wave: 'sawtooth', osc2Wave: 'triangle', osc2Level: 0.4, osc2Octave: 1,
    cutoff: 400, resonance: 2, filterEnv: 4, fDecay: 0.15, fSustain: 0,
    attack: 0.002, decay: 0.35, sustain: 0, release: 0.3, delayMix: 0.25, delayTime: 0.36, reverbMix: 0.2,
  }),
  t('keys', 'Teclado', {
    osc1Wave: 'triangle', osc2Wave: 'sine', osc2Level: 0.35, osc2Octave: 1,
    cutoff: 3000, filterEnv: 1, fDecay: 0.6,
    attack: 0.004, decay: 1.1, sustain: 0.3, release: 0.5, tremolo: 0.15, lfoRate: 4.5, chorus: 0.25, reverbMix: 0.2,
  }),
]

const SPEC_BY_KEY = new Map(BUILDER_PARAMS.map((s) => [s.key, s]))

function clampTo(key: string, value: number): number {
  const spec = SPEC_BY_KEY.get(key)
  if (!spec || spec.type !== 'number') return value
  return Math.min(spec.max, Math.max(spec.min, value))
}

/**
 * Aplica os macros (0..1, 0,5 = neutro) e devolve os valores efetivos para o motor.
 * - Brilho: corte ±2 oitavas e abertura do envelope do filtro ±1 oitava
 * - Suavidade: ataques ×/÷ 8 e liberação ×/÷ 2
 * - Espaço: soma até ±0,5 no reverb e ±0,3 no delay
 * - Movimento: soma até ±20 cents de vibrato e ±0,3 de LFO no filtro
 */
export function applyMacros(p: ParamValues): ParamValues {
  const m = (key: string) => Number(p[key] ?? 0.5) - 0.5 // -0,5..0,5
  const n = (key: string) => Number(p[key])
  const out: ParamValues = { ...p }
  const set = (key: string, value: number) => (out[key] = clampTo(key, value))

  set('cutoff', n('cutoff') * Math.pow(2, m('mBright') * 4))
  set('filterEnv', n('filterEnv') + m('mBright') * 2)
  const soft = Math.pow(2, m('mAttack') * 6)
  set('attack', n('attack') * soft)
  set('fAttack', n('fAttack') * soft)
  set('release', n('release') * Math.pow(2, m('mAttack') * 2))
  set('reverbMix', n('reverbMix') + m('mSpace'))
  set('delayMix', n('delayMix') + m('mSpace') * 0.6)
  set('vibrato', n('vibrato') + m('mMotion') * 40)
  set('lfoFilter', n('lfoFilter') + m('mMotion') * 0.6)
  return out
}

/** "Variar": pequenas mudanças aleatórias (±`amount` da faixa) nos parâmetros numéricos de som. */
export function varyParams(p: ParamValues, amount = 0.08, random = Math.random): ParamValues {
  const out: ParamValues = { ...p }
  for (const spec of BUILDER_PARAMS) {
    if (spec.type !== 'number' || spec.group === 'Macros' || spec.group === 'Saída') continue
    if (spec.key.endsWith('Octave') || spec.key.endsWith('Semi') || spec.key.endsWith('Unison')) continue
    const value = Number(p[spec.key])
    let next: number
    if (spec.log) {
      next = value * Math.pow(spec.max / spec.min, (random() * 2 - 1) * amount)
    } else {
      next = value + (random() * 2 - 1) * amount * (spec.max - spec.min)
    }
    // Só varia o que já está em uso (não liga efeitos/osciladores desligados).
    if (value === 0 && !spec.log) continue
    const stepped = Math.round(next / spec.step) * spec.step
    out[spec.key] = Number(Math.min(spec.max, Math.max(spec.min, stepped)).toFixed(4))
  }
  return out
}
