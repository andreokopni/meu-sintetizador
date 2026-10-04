// Layout de linhas do piano roll: no modo melódico, uma linha por nota (C8..A0);
// no modo bateria, uma linha por peça do kit (lista definida pelo instrumento).

import type { InstrumentDefinition } from '../audio/instruments/types'

export const MIN_PITCH = 21 // A0
export const MAX_PITCH = 108 // C8
/** Alturas de linha com zoom vertical 1x; o piano roll multiplica pelo zoom. */
export const MELODIC_ROW_H = 14
export const DRUM_ROW_H = 26
export const MIN_V_ZOOM = 0.6
export const MAX_V_ZOOM = 3.5

export interface RollLayout {
  /** Nota MIDI de cada linha, de cima para baixo. */
  rows: number[]
  rowH: number
  drum: boolean
  labels?: Record<number, string>
  /** Extensão natural do instrumento (fora dela a grade fica mais escura). */
  range?: [number, number]
  /** Índice da linha de uma nota, ou -1 se a nota não tem linha neste layout. */
  indexOf(pitch: number): number
}

const MELODIC_ROWS = Array.from({ length: MAX_PITCH - MIN_PITCH + 1 }, (_, i) => MAX_PITCH - i)

type LayoutSource = Pick<InstrumentDefinition, 'rows' | 'pitchLabels' | 'range'>

export function createLayout(def?: LayoutSource, vZoom = 1): RollLayout {
  if (def?.rows?.length) {
    const index = new Map(def.rows.map((p, i) => [p, i]))
    return {
      rows: def.rows,
      rowH: Math.round(DRUM_ROW_H * vZoom),
      drum: true,
      labels: def.pitchLabels,
      indexOf: (p) => index.get(p) ?? -1,
    }
  }
  return {
    rows: MELODIC_ROWS,
    rowH: Math.round(MELODIC_ROW_H * vZoom),
    drum: false,
    labels: def?.pitchLabels,
    range: def?.range,
    indexOf: (p) => (p >= MIN_PITCH && p <= MAX_PITCH ? MAX_PITCH - p : -1),
  }
}

/** Linha sob a coordenada vertical de conteúdo (limitada às linhas existentes). */
export function rowAtY(layout: RollLayout, cy: number): number {
  return Math.min(layout.rows.length - 1, Math.max(0, Math.floor(cy / layout.rowH)))
}

/**
 * Limita o deslocamento de linhas para que todas as notas continuem dentro do layout.
 * Notas sem linha (ex.: fora do kit de bateria) não restringem nem se movem.
 */
export function clampRowDelta(layout: RollLayout, pitches: number[], dRow: number): number {
  const indices = pitches.map((p) => layout.indexOf(p)).filter((i) => i >= 0)
  if (!indices.length) return 0
  const minDelta = -Math.min(...indices)
  const maxDelta = layout.rows.length - 1 - Math.max(...indices)
  return Math.min(maxDelta, Math.max(minDelta, dRow))
}

/** Nota resultante de mover `pitch` por `dRow` linhas (já limitado por clampRowDelta). */
export function shiftPitch(layout: RollLayout, pitch: number, dRow: number): number {
  const i = layout.indexOf(pitch)
  return i < 0 ? pitch : layout.rows[i + dRow]
}
