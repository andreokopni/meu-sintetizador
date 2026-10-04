// Converte notas livres do piano roll em eventos de partitura: grade de semicolcheia,
// acordes, vozes, divisão em compassos, ligaduras e valores (com ponto) legíveis.
// Unidades inteiras: DIV divisões por batida (semínima).

import type { Note } from '../model/project'

/** Divisões por batida: 4 = semicolcheia é a menor figura (sem quiálteras na v1). */
export const DIV = 4

export interface Chord {
  start: number
  end: number
  pitches: number[]
}

/** Nota/pausa já pronta para escrever: `pitches` vazio = pausa. */
export interface NotationEvent {
  start: number // dentro do compasso
  dur: number
  pitches: number[]
  type: string
  dots: number
  tieStart: boolean
  tieStop: boolean
  measureRest?: boolean
}

/** Arredonda para a grade e agrupa notas com mesmo início e fim em acordes. */
export function toChords(notes: Note[]): Chord[] {
  const map = new Map<string, Chord>()
  for (const n of notes) {
    const start = Math.max(0, Math.round(n.start * DIV))
    const end = Math.max(start + 1, Math.round((n.start + n.duration) * DIV))
    const key = `${start}:${end}`
    const chord = map.get(key) ?? { start, end, pitches: [] }
    if (!chord.pitches.includes(n.pitch)) chord.pitches.push(n.pitch)
    map.set(key, chord)
  }
  return [...map.values()]
    .map((c) => ({ ...c, pitches: c.pitches.sort((a, b) => a - b) }))
    .sort((a, b) => a.start - b.start || b.end - a.end)
}

/**
 * Distribui acordes em vozes sem sobreposição (máx. `maxVoices`).
 * Sobreposição pequena (efeito de pedal/legato) encurta a nota anterior em vez de criar voz:
 * só vira voz nova se a parte sobreposta for maior que a nota nova.
 */
export function splitVoices(chords: Chord[], maxVoices = 2): Chord[][] {
  const voices: Chord[][] = []
  for (const original of chords) {
    const chord = { ...original }
    const free = voices.find((v) => v[v.length - 1].end <= chord.start)
    if (free) {
      free.push(chord)
      continue
    }
    // voz cuja última nota termina primeiro
    let target = voices[0]
    for (const v of voices) if (v[v.length - 1].end < target[target.length - 1].end) target = v
    const last = target?.[target.length - 1]
    const overlap = last ? last.end - chord.start : Infinity
    const canTruncate = last && last.start < chord.start && overlap <= chord.end - chord.start
    if (canTruncate || (voices.length >= maxVoices && last && last.start < chord.start)) {
      last.end = chord.start
      target.push(chord)
    } else if (voices.length < maxVoices) {
      voices.push([chord])
    } else {
      // mesmo início que a última nota de todas as vozes: junta ao acorde mais próximo
      const merge = target[target.length - 1]
      for (const p of chord.pitches) if (!merge.pitches.includes(p)) merge.pitches.push(p)
      merge.pitches.sort((a, b) => a - b)
    }
  }
  return voices
}

// [duração em divisões (DIV=4), tipo MusicXML, pontos]
const VALUES: [number, string, number][] = [
  [16, 'whole', 0],
  [12, 'half', 1],
  [8, 'half', 0],
  [6, 'quarter', 1],
  [4, 'quarter', 0],
  [3, 'eighth', 1],
  [2, 'eighth', 0],
  [1, '16th', 0],
]

/** Figuras com ponto só começam alinhadas ao valor sem ponto (ex.: semínima pontuada no tempo). */
const alignment = (d: number, dots: number) => (dots ? (d * 2) / 3 : d)

/**
 * Quebra uma duração em figuras legíveis a partir de `pos` dentro do compasso.
 * Regras: figuras com ponto alinhadas; figura que começa fora do tempo não atravessa a
 * próxima batida (facilita enxergar onde cai cada tempo).
 */
export function decompose(pos: number, len: number): { pos: number; dur: number; type: string; dots: number }[] {
  const out: { pos: number; dur: number; type: string; dots: number }[] = []
  while (len > 0) {
    const nextBeat = Math.ceil((pos + 1) / DIV) * DIV
    const fits = (d: number, dots: number) =>
      d <= len && pos % alignment(d, dots) === 0 && (pos % DIV === 0 || pos + d <= nextBeat)
    const value = VALUES.find(([d, , dots]) => fits(d, dots)) ?? VALUES[VALUES.length - 1]
    const [d, type, dots] = value
    out.push({ pos, dur: d, type, dots })
    pos += d
    len -= d
  }
  return out
}

/** Transforma uma voz em compassos de eventos (pausas preenchidas, ligaduras entre compassos). */
export function voiceToMeasures(voice: Chord[], barLen: number, bars: number): NotationEvent[][] {
  const measures: NotationEvent[][] = Array.from({ length: bars }, () => [])
  const total = barLen * bars
  // segmentos contíguos de nota ou pausa
  const segments: { start: number; end: number; pitches: number[] }[] = []
  let t = 0
  for (const c of voice) {
    if (c.start >= total) break
    if (c.start > t) segments.push({ start: t, end: c.start, pitches: [] })
    segments.push({ start: c.start, end: Math.min(c.end, total), pitches: c.pitches })
    t = Math.min(c.end, total)
  }
  if (t < total) segments.push({ start: t, end: total, pitches: [] })

  for (const seg of segments) {
    let pos = seg.start
    while (pos < seg.end) {
      const bar = Math.floor(pos / barLen)
      const barEnd = (bar + 1) * barLen
      const pieceEnd = Math.min(seg.end, barEnd)
      const pieces = decompose(pos - bar * barLen, pieceEnd - pos)
      pieces.forEach((piece) => {
        const absStart = bar * barLen + piece.pos
        const isNote = seg.pitches.length > 0
        measures[bar].push({
          start: piece.pos,
          dur: piece.dur,
          pitches: seg.pitches,
          type: piece.type,
          dots: piece.dots,
          tieStop: isNote && absStart > seg.start,
          tieStart: isNote && absStart + piece.dur < seg.end,
        })
      })
      pos = pieceEnd
    }
  }

  // Compasso inteiro de pausa vira "pausa de compasso"
  return measures.map((events) =>
    events.every((e) => e.pitches.length === 0)
      ? [{ start: 0, dur: barLen, pitches: [], type: 'whole', dots: 0, tieStart: false, tieStop: false, measureRest: true }]
      : events,
  )
}

/** Bateria: cada golpe dura até o próximo (no máximo uma batida) — evita pausas a cada semicolcheia. */
export function drumChords(notes: Note[]): Chord[] {
  const chords = toChords(notes.map((n) => ({ ...n, duration: 1 / DIV })))
  const byStart = new Map<number, Chord>()
  for (const c of chords) {
    const existing = byStart.get(c.start)
    if (existing) existing.pitches = [...new Set([...existing.pitches, ...c.pitches])].sort((a, b) => a - b)
    else byStart.set(c.start, { ...c })
  }
  const merged = [...byStart.values()].sort((a, b) => a.start - b.start)
  merged.forEach((c, i) => {
    const next = merged[i + 1]?.start ?? c.start + DIV
    c.end = Math.max(c.start + 1, Math.min(next, c.start + DIV))
  })
  return merged
}
