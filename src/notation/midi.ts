// Arquivo MIDI padrão (SMF tipo 1) — abre em qualquer DAW/editor de partitura.

import type { Note } from '../model/project'

export interface MidiTrack {
  name: string
  notes: Note[]
  /** 0..15; 9 = bateria (General MIDI). */
  channel: number
  /** Programa General MIDI 0..127 (ignorado no canal 9). */
  program: number
  /** 0..1 */
  volume: number
}

export interface MidiInput {
  bpm: number
  beatsPerBar: number
  tracks: MidiTrack[]
}

export const PPQ = 480

function vlq(value: number): number[] {
  const bytes = [value & 0x7f]
  value >>= 7
  while (value > 0) {
    bytes.unshift((value & 0x7f) | 0x80)
    value >>= 7
  }
  return bytes
}

function text(s: string): number[] {
  return [...new TextEncoder().encode(s)]
}

function chunk(type: string, data: number[]): number[] {
  const len = data.length
  return [...text(type), (len >>> 24) & 255, (len >>> 16) & 255, (len >>> 8) & 255, len & 255, ...data]
}

/** Eventos com tempo absoluto -> bytes com tempo delta, terminando a faixa. */
function trackBytes(events: { tick: number; order: number; bytes: number[] }[]): number[] {
  events.sort((a, b) => a.tick - b.tick || a.order - b.order)
  const out: number[] = []
  let last = 0
  for (const e of events) {
    out.push(...vlq(e.tick - last), ...e.bytes)
    last = e.tick
  }
  out.push(0, 0xff, 0x2f, 0x00)
  return out
}

export function buildMidi(input: MidiInput): Uint8Array {
  const usPerQuarter = Math.round(60_000_000 / input.bpm)
  const conductor = trackBytes([
    { tick: 0, order: 0, bytes: [0xff, 0x51, 0x03, (usPerQuarter >> 16) & 255, (usPerQuarter >> 8) & 255, usPerQuarter & 255] },
    { tick: 0, order: 1, bytes: [0xff, 0x58, 0x04, input.beatsPerBar, 2, 24, 8] },
  ])

  const tracks = input.tracks.map((t) => {
    const ch = t.channel & 15
    const name = text(t.name)
    const events: { tick: number; order: number; bytes: number[] }[] = [
      { tick: 0, order: 0, bytes: [0xff, 0x03, ...vlq(name.length), ...name] },
      { tick: 0, order: 1, bytes: [0xb0 | ch, 7, Math.round(t.volume * 127)] },
    ]
    if (ch !== 9) events.push({ tick: 0, order: 2, bytes: [0xc0 | ch, t.program & 127] })
    for (const n of t.notes) {
      const on = Math.round(n.start * PPQ)
      const off = Math.max(on + 1, Math.round((n.start + n.duration) * PPQ))
      const vel = Math.max(1, Math.min(127, Math.round(n.velocity * 127)))
      // note-off antes de note-on no mesmo tick (notas repetidas não se cortam)
      events.push({ tick: on, order: 4, bytes: [0x90 | ch, n.pitch, vel] })
      events.push({ tick: off, order: 3, bytes: [0x80 | ch, n.pitch, 0] })
    }
    return trackBytes(events)
  })

  const header = [0, 1, 0, tracks.length + 1, (PPQ >> 8) & 255, PPQ & 255]
  return new Uint8Array([...chunk('MThd', header), ...chunk('MTrk', conductor), ...tracks.flatMap((t) => chunk('MTrk', t))])
}
