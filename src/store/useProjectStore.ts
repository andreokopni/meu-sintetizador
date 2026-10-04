import { create } from 'zustand'
import { effectiveParams, getInstrument } from '../audio/instruments/registry'
import { createDemoProject } from '../model/demo'
import {
  createNote,
  createTrack,
  type Note,
  type ParamValue,
  type ParamValues,
  type Project,
  type Track,
} from '../model/project'

const HISTORY_LIMIT = 200

interface ProjectState {
  project: Project
  selectedTrackId: string | null
  selectedNoteIds: string[]
  /** Grade do piano roll, em batidas (1 = semínima, 0.25 = semicolcheia). */
  snap: number
  filePath: string | null
  dirty: boolean
  loop: boolean
  isPlaying: boolean
  /** Onde a reprodução começa (e para onde volta ao parar). */
  playStart: number
  /** Mensagem de operação em andamento (ex.: exportando); bloqueia a interface. */
  busy: string | null
  past: Project[]
  future: Project[]

  /** Aplica uma alteração ao projeto. history=false para passos intermediários de um arraste. */
  apply(updater: (p: Project) => Project, history?: boolean): void
  /** Grava o estado atual no histórico (início de um gesto de arrastar). */
  checkpoint(): void
  undo(): void
  redo(): void
  loadProject(project: Project, filePath: string | null): void
  markSaved(filePath: string): void

  selectTrack(id: string | null): void
  selectNotes(ids: string[]): void
  setSnap(snap: number): void
  setLoop(loop: boolean): void
  setPlaying(playing: boolean): void
  setPlayStart(beat: number): void
  setBusy(message: string | null): void

  addTrack(instrumentId: string): void
  removeTrack(id: string): void
  updateTrack(id: string, patch: Partial<Omit<Track, 'id' | 'notes'>>, history?: boolean): void
  setInstrument(id: string, instrumentId: string): void
  setTrackParam(id: string, key: string, value: ParamValue, history?: boolean): void
  /** Substitui todos os parâmetros (modelos, variar, A/B do construtor). */
  setTrackParams(id: string, params: ParamValues, history?: boolean): void
  resetTrackParams(id: string): void

  addNote(trackId: string, pitch: number, start: number, duration: number): Note
  updateNotes(trackId: string, changes: Record<string, Partial<Note>>, history?: boolean): void
  deleteNotes(trackId: string, ids: string[]): void
}

const mapTrack = (p: Project, id: string, fn: (t: Track) => Track): Project => ({
  ...p,
  tracks: p.tracks.map((t) => (t.id === id ? fn(t) : t)),
})

const demo = createDemoProject()

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: demo,
  selectedTrackId: demo.tracks[0]?.id ?? null,
  selectedNoteIds: [],
  snap: 0.25,
  filePath: null,
  dirty: false,
  loop: true,
  isPlaying: false,
  playStart: 0,
  busy: null,
  past: [],
  future: [],

  apply(updater, history = true) {
    const { project, past } = get()
    const next = updater(project)
    if (next === project) return
    set({
      project: next,
      dirty: true,
      ...(history ? { past: [...past, project].slice(-HISTORY_LIMIT), future: [] } : {}),
    })
  },

  checkpoint() {
    const { project, past } = get()
    set({ past: [...past, project].slice(-HISTORY_LIMIT), future: [] })
  },

  undo() {
    const { past, project, future } = get()
    if (!past.length) return
    set({ project: past[past.length - 1], past: past.slice(0, -1), future: [project, ...future], dirty: true })
    fixSelection()
  },

  redo() {
    const { past, project, future } = get()
    if (!future.length) return
    set({ project: future[0], future: future.slice(1), past: [...past, project], dirty: true })
    fixSelection()
  },

  loadProject(project, filePath) {
    set({
      project,
      filePath,
      dirty: false,
      past: [],
      future: [],
      selectedTrackId: project.tracks[0]?.id ?? null,
      selectedNoteIds: [],
      playStart: 0,
    })
  },

  markSaved(filePath) {
    set({ filePath, dirty: false })
  },

  selectTrack(id) {
    if (id !== get().selectedTrackId) set({ selectedTrackId: id, selectedNoteIds: [] })
  },
  selectNotes(ids) {
    set({ selectedNoteIds: ids })
  },
  setSnap(snap) {
    set({ snap })
  },
  setLoop(loop) {
    set({ loop })
  },
  setPlaying(isPlaying) {
    set({ isPlaying })
  },
  setPlayStart(playStart) {
    set({ playStart: Math.max(0, playStart) })
  },
  setBusy(busy) {
    set({ busy })
  },

  addTrack(instrumentId) {
    const def = getInstrument(instrumentId)
    const index = get().project.tracks.length
    const track = createTrack(def.name, def.id, {}, index)
    get().apply((p) => ({ ...p, tracks: [...p.tracks, track] }))
    set({ selectedTrackId: track.id, selectedNoteIds: [] })
  },

  removeTrack(id) {
    const { project, selectedTrackId } = get()
    const index = project.tracks.findIndex((t) => t.id === id)
    get().apply((p) => ({ ...p, tracks: p.tracks.filter((t) => t.id !== id) }))
    if (selectedTrackId === id) {
      const remaining = get().project.tracks
      set({ selectedTrackId: remaining[Math.min(index, remaining.length - 1)]?.id ?? null, selectedNoteIds: [] })
    }
  },

  updateTrack(id, patch, history = true) {
    get().apply((p) => mapTrack(p, id, (t) => ({ ...t, ...patch })), history)
  },

  setInstrument(id, instrumentId) {
    get().apply((p) => mapTrack(p, id, (t) => ({ ...t, instrumentId, params: {} })))
  },

  setTrackParam(id, key, value, history = true) {
    get().apply((p) => mapTrack(p, id, (t) => ({ ...t, params: { ...effectiveParams(t), [key]: value } })), history)
  },

  setTrackParams(id, params, history = true) {
    get().apply((p) => mapTrack(p, id, (t) => ({ ...t, params: { ...params } })), history)
  },

  resetTrackParams(id) {
    get().apply((p) => mapTrack(p, id, (t) => ({ ...t, params: {} })))
  },

  addNote(trackId, pitch, start, duration) {
    const note = createNote(pitch, start, duration)
    get().apply((p) => mapTrack(p, trackId, (t) => ({ ...t, notes: [...t.notes, note] })))
    return note
  },

  updateNotes(trackId, changes, history = true) {
    get().apply(
      (p) =>
        mapTrack(p, trackId, (t) => ({
          ...t,
          notes: t.notes.map((n) => (changes[n.id] ? { ...n, ...changes[n.id] } : n)),
        })),
      history,
    )
  },

  deleteNotes(trackId, ids) {
    if (!ids.length) return
    const remove = new Set(ids)
    get().apply((p) => mapTrack(p, trackId, (t) => ({ ...t, notes: t.notes.filter((n) => !remove.has(n.id)) })))
    set({ selectedNoteIds: get().selectedNoteIds.filter((id) => !remove.has(id)) })
  },
}))

/** Após desfazer/refazer, garante que a faixa selecionada ainda existe. */
function fixSelection() {
  const { project, selectedTrackId } = useProjectStore.getState()
  if (!project.tracks.some((t) => t.id === selectedTrackId)) {
    useProjectStore.setState({ selectedTrackId: project.tracks[0]?.id ?? null, selectedNoteIds: [] })
  }
}
