// Importa partituras MusicXML (partwise) como projeto. Usa o DOMParser do navegador.
// Limitações v1: repetições/voltas não são expandidas; só o primeiro andamento é usado.

import { createEmptyProject, createNote, createTrack, type Note, type Project } from '../model/project'
import { fitInstrumentToRange, instrumentForName, instrumentForProgram, mapDrumNote } from './gm'

const STEP: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

// Posição na pauta de percussão -> peça GM (usado quando a parte não informa midi-unpitched).
const DRUM_BY_DISPLAY: Record<string, number> = {
  F4: 36, E4: 36, C5: 38, A4: 41, D5: 45, E5: 48, G5: 42, A5: 49, F5: 51, B4: 39,
}

const child = (el: Element | null | undefined, name: string) =>
  el ? Array.from(el.children).find((c) => c.localName === name) ?? null : null
const children = (el: Element | null | undefined, name: string) =>
  el ? Array.from(el.children).filter((c) => c.localName === name) : []
const text = (el: Element | null | undefined, name: string) => child(el, name)?.textContent?.trim() ?? ''
const num = (el: Element | null | undefined, name: string, fallback = 0) => {
  const v = Number(text(el, name))
  return Number.isFinite(v) && text(el, name) !== '' ? v : fallback
}

interface PartInfo {
  name: string
  program?: number
  /** id do instrumento da parte -> nota GM de percussão */
  unpitched: Map<string, number>
}

function readPartList(root: Element): Map<string, PartInfo> {
  const parts = new Map<string, PartInfo>()
  for (const sp of children(child(root, 'part-list'), 'score-part')) {
    const info: PartInfo = { name: text(sp, 'part-name') || text(sp, 'part-abbreviation'), unpitched: new Map() }
    for (const mi of children(sp, 'midi-instrument')) {
      const program = num(mi, 'midi-program', 0)
      if (program && info.program === undefined) info.program = program - 1 // MusicXML usa 1..128
      const unpitched = num(mi, 'midi-unpitched', 0)
      if (unpitched) info.unpitched.set(mi.getAttribute('id') ?? '', unpitched - 1)
    }
    parts.set(sp.getAttribute('id') ?? '', info)
  }
  return parts
}

export function importMusicXml(xml: string, fileName = 'Partitura importada'): Project {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const root = doc.documentElement
  if (!root || root.localName === 'parsererror' || doc.getElementsByTagName('parsererror').length) {
    throw new Error('Arquivo MusicXML inválido.')
  }
  if (root.localName === 'score-timewise') throw new Error('MusicXML "timewise" não é suportado; exporte como "partwise".')
  if (root.localName !== 'score-partwise') throw new Error('Este arquivo não é uma partitura MusicXML.')

  const partInfo = readPartList(root)
  const title =
    text(child(root, 'work'), 'work-title') || text(root, 'movement-title') || fileName.replace(/\.(musicxml|xml|mxl)$/i, '')
  const project: Project = { ...createEmptyProject(), name: title }
  let bpm = 0
  let beatsPerBar = 0

  for (const part of children(root, 'part')) {
    const info: PartInfo = partInfo.get(part.getAttribute('id') ?? '') ?? { name: '', unpitched: new Map() }
    let divisions = 1
    let measureStart = 0 // em batidas (semínimas)
    let measureLen = 4
    let percussion = false
    const notes: Note[] = []
    const openTies = new Map<string, Note>() // "voz:altura" -> nota aguardando continuação

    children(part, 'measure').forEach((measure, measureIndex) => {
      let cursor = 0 // em divisões, dentro do compasso
      let maxCursor = 0
      let lastStart = 0

      for (const el of Array.from(measure.children)) {
        switch (el.localName) {
          case 'attributes': {
            divisions = num(el, 'divisions', divisions) || divisions
            const time = child(el, 'time')
            if (time) {
              const beats = num(time, 'beats', 4)
              const beatType = num(time, 'beat-type', 4)
              measureLen = (beats * 4) / beatType
              if (!beatsPerBar) beatsPerBar = Math.max(1, Math.round(measureLen))
            }
            if (children(el, 'clef').some((c) => text(c, 'sign') === 'percussion')) percussion = true
            break
          }
          case 'direction':
          case 'sound': {
            const sound = el.localName === 'sound' ? el : child(el, 'sound')
            const tempo = Number(sound?.getAttribute('tempo'))
            if (!bpm && tempo > 0) bpm = tempo
            break
          }
          case 'backup':
            cursor -= num(el, 'duration')
            break
          case 'forward':
            cursor += num(el, 'duration')
            maxCursor = Math.max(maxCursor, cursor)
            break
          case 'note': {
            if (child(el, 'grace') || child(el, 'cue')) break
            const duration = num(el, 'duration')
            const isChord = !!child(el, 'chord')
            const start = isChord ? lastStart : cursor
            if (!isChord) {
              lastStart = cursor
              cursor += duration
              maxCursor = Math.max(maxCursor, cursor)
            }
            if (child(el, 'rest')) break

            let pitch: number | undefined
            const p = child(el, 'pitch')
            const unpitched = child(el, 'unpitched')
            if (p) {
              pitch = (num(p, 'octave', 4) + 1) * 12 + (STEP[text(p, 'step')] ?? 0) + Math.round(num(p, 'alter', 0))
            } else if (unpitched) {
              const instrumentId = child(el, 'instrument')?.getAttribute('id') ?? ''
              pitch =
                info.unpitched.get(instrumentId) ??
                DRUM_BY_DISPLAY[`${text(unpitched, 'display-step')}${text(unpitched, 'display-octave')}`]
              percussion = true
            }
            if (pitch === undefined || duration <= 0) break

            const startBeat = measureStart + start / divisions
            const durBeats = duration / divisions
            const voice = text(el, 'voice') || '1'
            const key = `${voice}:${pitch}`
            const ties = children(el, 'tie').map((t) => t.getAttribute('type'))
            const prev = openTies.get(key)
            if (ties.includes('stop') && prev && Math.abs(prev.start + prev.duration - startBeat) < 1e-6) {
              prev.duration += durBeats // continuação ligada: estende a nota anterior
              if (!ties.includes('start')) openTies.delete(key)
              break
            }
            const dynamics = Number(el.getAttribute('dynamics'))
            const velocity = dynamics > 0 ? Math.min(1, dynamics / 112) : 0.8
            const note = createNote(pitch, startBeat, durBeats, velocity)
            notes.push(note)
            if (ties.includes('start')) openTies.set(key, note)
            break
          }
        }
      }
      // Anacruse (1º compasso ou marcado implicit="yes") ocupa só o que tem; os demais, o compasso todo.
      const actual = maxCursor / divisions
      const pickup = measureIndex === 0 || measure.getAttribute('implicit') === 'yes'
      measureStart += pickup && actual > 0 && actual < measureLen ? actual : measureLen
    })

    if (!notes.length) continue
    const name = info.name || `Parte ${project.tracks.length + 1}`
    const instrumentId = percussion
      ? 'drums'
      : fitInstrumentToRange(
          instrumentForName(name) ?? (info.program !== undefined ? instrumentForProgram(info.program) : 'sample:piano'),
          notes.map((n) => n.pitch),
        )
    const track = createTrack(name, instrumentId, {}, project.tracks.length)
    track.notes =
      instrumentId === 'drums'
        ? notes.flatMap((n) => {
            const pitch = mapDrumNote(n.pitch)
            return pitch === undefined ? [] : [{ ...n, pitch, duration: Math.min(n.duration, 0.25) }]
          })
        : notes
    if (track.notes.length) project.tracks.push(track)
  }

  if (!project.tracks.length) throw new Error('A partitura não tem notas.')
  project.bpm = Math.round(Math.min(300, Math.max(20, bpm || 100)))
  project.beatsPerBar = beatsPerBar || 4
  const lastEnd = Math.max(...project.tracks.flatMap((t) => t.notes.map((n) => n.start + n.duration)))
  project.lengthBars = Math.min(512, Math.max(1, Math.ceil(lastEnd / project.beatsPerBar - 1e-6)))
  return project
}
