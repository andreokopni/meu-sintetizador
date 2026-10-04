import { DRUM_PITCHES } from '../audio/instruments/synths'
import { createEmptyProject, createNote, createTrack, type Note, type Project } from './project'

/** Projeto de exemplo: 8 compassos com bateria, baixo, piano e melodia. */
export function createDemoProject(): Project {
  const project = { ...createEmptyProject(), name: 'Demonstração', bpm: 104, lengthBars: 8 }
  const bars = 8

  const drums = createTrack('Bateria', 'drums', {}, 0)
  for (let bar = 0; bar < bars; bar++) {
    const b = bar * 4
    drums.notes.push(createNote(DRUM_PITCHES.kick, b, 0.25, 0.95), createNote(DRUM_PITCHES.kick, b + 2.5, 0.25, 0.8))
    drums.notes.push(createNote(DRUM_PITCHES.kick, b + 2, 0.25, 0.9))
    drums.notes.push(createNote(DRUM_PITCHES.snare, b + 1, 0.25, 0.85), createNote(DRUM_PITCHES.snare, b + 3, 0.25, 0.85))
    for (let i = 0; i < 8; i++) {
      const pitch = i === 7 && bar % 2 === 1 ? DRUM_PITCHES.openHat : DRUM_PITCHES.closedHat
      drums.notes.push(createNote(pitch, b + i * 0.5, 0.25, i % 2 === 0 ? 0.7 : 0.45))
    }
  }
  drums.notes.push(createNote(DRUM_PITCHES.crash, 0, 1, 0.7))

  // Progressão: C - Am - F - G (duas vezes)
  const chords = [
    [48, 52, 55, 60],
    [45, 52, 57, 60],
    [41, 53, 57, 60],
    [43, 50, 55, 59],
  ]

  const bass = createTrack('Baixo', 'synth-bass', {}, 1)
  const piano = createTrack('Piano', 'sample:piano', {}, 2)
  for (let bar = 0; bar < bars; bar++) {
    const chord = chords[bar % 4]
    const root = chord[0] - 12
    const b = bar * 4
    bass.notes.push(createNote(root, b, 0.75), createNote(root, b + 1, 0.5), createNote(root + 12, b + 1.5, 0.5))
    bass.notes.push(createNote(root, b + 2, 0.75), createNote(root + 7, b + 3, 0.5), createNote(root, b + 3.5, 0.5))
    for (const pitch of chord.slice(1)) {
      piano.notes.push(createNote(pitch + 12, b, 1.5, 0.6), createNote(pitch + 12, b + 2.5, 1.5, 0.5))
    }
  }

  const lead = createTrack('Melodia', 'pluck', {}, 3)
  const melody: [number, number, number][] = [
    [76, 0, 1], [79, 1, 0.5], [76, 1.5, 0.5], [74, 2, 1], [72, 3, 1],
    [72, 4, 1], [76, 5, 1], [79, 6, 1.5], [81, 7.5, 0.5],
    [81, 8, 1], [79, 9, 0.5], [77, 9.5, 0.5], [76, 10, 1], [72, 11, 1],
    [74, 12, 1.5], [76, 13.5, 0.5], [74, 14, 1], [71, 15, 1],
  ]
  const notes: Note[] = []
  for (const offset of [0, 16]) for (const [p, s, d] of melody) notes.push(createNote(p, s + offset, d, 0.75))
  lead.notes = notes

  project.tracks = [drums, bass, piano, lead]
  return project
}
