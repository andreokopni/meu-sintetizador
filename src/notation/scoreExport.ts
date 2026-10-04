// Liga o projeto (instrumentos do registro) aos geradores puros de MusicXML e MIDI.

import { getInstrument } from '../audio/instruments/registry'
import { getTimbre, isUserTimbre } from '../audio/instruments/userTimbres'
import type { Project, Track } from '../model/project'
import { buildMidi } from './midi'
import { buildMusicXml, type PartKind } from './musicxml'

/** Instrumento "de fábrica" por trás da faixa (timbres do usuário apontam para o base). */
function baseInstrumentId(track: Track): string {
  return isUserTimbre(track.instrumentId) ? (getTimbre(track.instrumentId)?.baseInstrumentId ?? 'lead') : track.instrumentId
}

const PIANO_LIKE = new Set(['sample:piano', 'epiano', 'organ'])

export function partKind(track: Track): PartKind {
  if (getInstrument(track.instrumentId).rows) return 'drums'
  return PIANO_LIKE.has(baseInstrumentId(track)) ? 'piano' : 'melodic'
}

// Programa General MIDI aproximado para cada instrumento base.
const GM_PROGRAM: Record<string, number> = {
  'sample:piano': 0,
  epiano: 4,
  bell: 14,
  organ: 16,
  'sample:guitar': 24,
  'sample:bass-electric': 33,
  'synth-bass': 38,
  'sample:violin': 40,
  pluck: 45,
  'sample:flute': 73,
  lead: 81,
  builder: 81,
  pad: 89,
}

export function buildProjectMusicXml(project: Project, tracks: Track[]): string {
  return buildMusicXml({
    title: project.name,
    bpm: project.bpm,
    beatsPerBar: project.beatsPerBar,
    parts: tracks.map((t) => ({ name: t.name, kind: partKind(t), notes: t.notes })),
  })
}

export function buildProjectMidi(project: Project, tracks: Track[]): Uint8Array {
  // Canal 9 (o "10" do MIDI) é reservado à bateria; os demais são distribuídos em sequência.
  let next = 0
  const nextChannel = () => {
    if (next === 9) next++
    return next++ % 16
  }
  return buildMidi({
    bpm: project.bpm,
    beatsPerBar: project.beatsPerBar,
    tracks: tracks.map((t) => ({
      name: t.name,
      notes: t.notes,
      channel: partKind(t) === 'drums' ? 9 : nextChannel(),
      program: GM_PROGRAM[baseInstrumentId(t)] ?? 0,
      volume: t.volume,
    })),
  })
}
