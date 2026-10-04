// Mapeamentos General MIDI usados na importação: programa/nome da parte -> instrumento do app
// e peças de percussão GM -> peças do kit da bateria sintetizada.

/** Programa GM (0..127) -> id de instrumento de fábrica do app. */
export function instrumentForProgram(program: number): string {
  if (program <= 3) return 'sample:piano'
  if (program <= 5) return 'epiano'
  if (program <= 7) return 'sample:piano'
  if (program <= 15) return 'bell' // percussão cromática (celesta, glockenspiel, sinos...)
  if (program <= 23) return 'organ'
  if (program <= 31) return 'sample:guitar'
  if (program <= 39) return program >= 38 ? 'synth-bass' : 'sample:bass-electric'
  if (program <= 47) return 'sample:violin' // cordas solo, pizzicato, harpa
  if (program <= 55) return 'pad' // conjuntos de cordas e coro
  if (program <= 63) return 'lead' // metais
  if (program <= 79) return 'sample:flute' // palhetas e flautas
  if (program <= 87) return 'lead'
  if (program <= 95) return 'pad'
  if (program <= 103) return 'pad'
  if (program <= 111) return 'sample:guitar' // étnicos (banjo, sitar...)
  if (program <= 119) return 'drums'
  return 'pad'
}

const NAME_RULES: [RegExp, string][] = [
  [/drum|bateria|percuss|schlag|batterie|kit/i, 'drums'],
  [/piano|klavier|pianoforte|keyboard|teclado|cembalo|harpsichord|cravo/i, 'sample:piano'],
  [/organ|órgão|orgel|orgue/i, 'organ'],
  [/violin|violino|violon|geige|viola|cello|violoncel|fiddle/i, 'sample:violin'],
  [/contrabass|double bass|kontrabass|bass|baixo|basso/i, 'sample:bass-electric'],
  [/guitar|violão|guitarra|gitarre|guitare|lute|alaúde/i, 'sample:guitar'],
  [/flute|flauta|flöte|flauto|piccolo|recorder|oboe|oboé|clarinet|clarinete|sax/i, 'sample:flute'],
  [/string|cordas|choir|coro|chor|ensemble/i, 'pad'],
  [/voice|voz|vocal|soprano|alto|tenor|bariton|canto|melod/i, 'sample:flute'],
  [/trumpet|trompete|horn|trompa|trombon|tuba|brass|metais/i, 'lead'],
  [/bell|sino|glock|celesta|vibraphon|marimba|xylophon/i, 'bell'],
]

/** Adivinha o instrumento pelo nome da parte (português, inglês, alemão, italiano, francês). */
export function instrumentForName(name: string): string | undefined {
  return NAME_RULES.find(([re]) => re.test(name))?.[1]
}

// Extensão natural dos samplers (mesma regra de samplers.ts: sample extremo ± 4 semitons).
// Fixa aqui para o importador não depender do Tone.js; atualize se os samples mudarem.
const SAMPLER_RANGES: Record<string, [number, number]> = {
  'sample:piano': [20, 109],
  'sample:guitar': [31, 87],
  'sample:violin': [51, 100],
  'sample:flute': [56, 100],
  'sample:bass-electric': [21, 77],
}

/**
 * Se mais de 25% das notas caem fora da extensão natural do sampler escolhido (ex.: violoncelo
 * mapeado para violino), usa o Pad, que soa bem em qualquer altura.
 */
export function fitInstrumentToRange(instrumentId: string, pitches: number[]): string {
  const range = SAMPLER_RANGES[instrumentId]
  if (!range || !pitches.length) return instrumentId
  const outside = pitches.filter((p) => p < range[0] || p > range[1]).length
  return outside / pitches.length > 0.25 ? 'pad' : instrumentId
}

/** Peças do kit da bateria sintetizada (General MIDI). */
const KIT = new Set([36, 37, 38, 39, 41, 42, 45, 46, 48, 49, 51, 56])

// Peças GM fora do kit -> peça mais parecida do kit.
const DRUM_FALLBACK: Record<number, number> = {
  35: 36, // bumbo acústico
  40: 38, // caixa elétrica
  43: 41, 47: 45, 50: 48, // tons
  44: 42, // chimbal com o pé
  52: 49, 55: 49, 57: 49, // pratos chinês, splash, ataque 2
  53: 51, 59: 51, // condução (cúpula, 2)
  54: 42, 69: 42, 70: 42, 82: 42, // pandeirola, cabasa, maracas, shaker
  58: 56, 67: 56, 68: 56, 75: 37, 76: 37, 77: 37, // vibraslap, agogôs, claves, blocos
  60: 48, 61: 45, 62: 48, 63: 45, 64: 41, 65: 48, 66: 45, // bongôs, congas, timbales
  71: 42, 72: 42, 73: 37, 74: 37, 78: 56, 79: 56, 80: 42, 81: 46, // apitos, guiro, cuíca, triângulo
}

/** Nota de percussão GM -> peça do kit (ou undefined se não houver equivalente). */
export function mapDrumNote(pitch: number): number | undefined {
  if (KIT.has(pitch)) return pitch
  return DRUM_FALLBACK[pitch]
}
