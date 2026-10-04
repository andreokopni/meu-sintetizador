// Detecção de armadura de clave e grafia das notas.

export interface WeightedPitch {
  pitch: number
  weight: number
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11]

/**
 * Escolhe a armadura (em quintas: -6 = 6 bemóis ... 6 = 6 sustenidos) cuja escala maior
 * deixa menos notas de fora (ponderado pela duração). Empate: menos acidentes.
 * Tons menores usam a mesma armadura do relativo maior, então isso basta para a pauta.
 */
export function detectFifths(notes: WeightedPitch[]): number {
  let best = 0
  let bestCost = Infinity
  for (let fifths = -6; fifths <= 6; fifths++) {
    const tonic = (((fifths * 7) % 12) + 12) % 12
    const scale = new Set(MAJOR.map((s) => (s + tonic) % 12))
    let cost = 0
    for (const n of notes) if (!scale.has(n.pitch % 12)) cost += n.weight
    if (cost < bestCost - 1e-9 || (Math.abs(cost - bestCost) < 1e-9 && Math.abs(fifths) < Math.abs(best))) {
      best = fifths
      bestCost = cost
    }
  }
  return best
}

const SHARP_SPELLING: [string, number][] = [
  ['C', 0], ['C', 1], ['D', 0], ['D', 1], ['E', 0], ['F', 0], ['F', 1], ['G', 0], ['G', 1], ['A', 0], ['A', 1], ['B', 0],
]
const FLAT_SPELLING: [string, number][] = [
  ['C', 0], ['D', -1], ['D', 0], ['E', -1], ['E', 0], ['F', 0], ['G', -1], ['G', 0], ['A', -1], ['A', 0], ['B', -1], ['B', 0],
]

/** Nome da nota (passo, alteração, oitava) usando sustenidos ou bemóis conforme a armadura. */
export function spell(pitch: number, fifths: number): { step: string; alter: number; octave: number } {
  const [step, alter] = (fifths < 0 ? FLAT_SPELLING : SHARP_SPELLING)[pitch % 12]
  return { step, alter, octave: Math.floor(pitch / 12) - 1 }
}
