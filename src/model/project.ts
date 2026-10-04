// Modelo de dados do projeto. É JSON puro: fácil de salvar, versionar e de ser
// gerado/editado por uma IA no futuro. Tempo sempre em batidas (beats).

export const PROJECT_VERSION = 1

export type ParamValue = number | string
export type ParamValues = Record<string, ParamValue>

export interface Note {
  id: string
  /** Número MIDI (60 = Dó central). */
  pitch: number
  /** Início em batidas, a partir do começo da música. */
  start: number
  /** Duração em batidas. */
  duration: number
  /** 0..1 */
  velocity: number
}

export interface Track {
  id: string
  name: string
  color: string
  instrumentId: string
  params: ParamValues
  /** 0..1 (linear) */
  volume: number
  /** -1 (esquerda) .. 1 (direita) */
  pan: number
  mute: boolean
  solo: boolean
  notes: Note[]
}

export interface Project {
  version: number
  name: string
  bpm: number
  beatsPerBar: number
  lengthBars: number
  tracks: Track[]
}

export const TRACK_COLORS = ['#7c6cff', '#ff6c9d', '#3fd0c9', '#ffb84d', '#7ddc6a', '#5aa9ff', '#e07cff', '#ff7a59']

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

export function createNote(pitch: number, start: number, duration: number, velocity = 0.8): Note {
  return { id: uid(), pitch, start, duration, velocity }
}

export function createTrack(
  name: string,
  instrumentId: string,
  params: ParamValues,
  index: number,
): Track {
  return {
    id: uid(),
    name,
    color: TRACK_COLORS[index % TRACK_COLORS.length],
    instrumentId,
    params: { ...params },
    volume: 0.8,
    pan: 0,
    mute: false,
    solo: false,
    notes: [],
  }
}

export function createEmptyProject(): Project {
  return { version: PROJECT_VERSION, name: 'Nova música', bpm: 110, beatsPerBar: 4, lengthBars: 16, tracks: [] }
}

export function projectLengthBeats(project: Project): number {
  return project.lengthBars * project.beatsPerBar
}

/** Fim da última nota (em batidas), ou 0 se não houver notas. */
export function lastNoteEnd(project: Project): number {
  let end = 0
  for (const t of project.tracks) for (const n of t.notes) end = Math.max(end, n.start + n.duration)
  return end
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export function pitchName(pitch: number): string {
  return `${NOTE_NAMES[pitch % 12]}${Math.floor(pitch / 12) - 1}`
}

export function isBlackKey(pitch: number): boolean {
  return [1, 3, 6, 8, 10].includes(pitch % 12)
}
