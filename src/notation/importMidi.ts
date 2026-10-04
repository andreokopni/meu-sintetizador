// Importa arquivos MIDI padrão (SMF formato 0 e 1) como projeto.

import { createEmptyProject, createNote, createTrack, type Note, type Project } from '../model/project'
import { fitInstrumentToRange, instrumentForName, instrumentForProgram, mapDrumNote } from './gm'

interface RawTrack {
  name: string
  /** notas por canal */
  channels: Map<number, Note[]>
  programs: Map<number, number>
}

class Reader {
  pos = 0
  constructor(private data: Uint8Array) {}
  get done() {
    return this.pos >= this.data.length
  }
  u8() {
    return this.data[this.pos++]
  }
  u16() {
    return (this.u8() << 8) | this.u8()
  }
  u32() {
    return ((this.u8() << 24) | (this.u8() << 16) | (this.u8() << 8) | this.u8()) >>> 0
  }
  str(n: number) {
    const s = new TextDecoder('latin1').decode(this.data.subarray(this.pos, this.pos + n))
    this.pos += n
    return s
  }
  bytes(n: number) {
    const b = this.data.subarray(this.pos, this.pos + n)
    this.pos += n
    return b
  }
  vlq() {
    let value = 0
    for (let i = 0; i < 4; i++) {
      const b = this.u8()
      value = (value << 7) | (b & 0x7f)
      if (!(b & 0x80)) break
    }
    return value
  }
}

export function importMidi(buffer: ArrayBuffer, fileName = 'MIDI importado'): Project {
  const r = new Reader(new Uint8Array(buffer))
  if (r.str(4) !== 'MThd') throw new Error('Arquivo MIDI inválido.')
  const headerLen = r.u32()
  const format = r.u16()
  const trackCount = r.u16()
  const division = r.u16()
  r.pos += headerLen - 6
  if (division & 0x8000) throw new Error('MIDI com tempo SMPTE não é suportado.')
  const ppq = division
  if (format > 1) throw new Error('MIDI formato 2 não é suportado.')

  let bpm = 0
  let beatsPerBar = 0
  const tracks: RawTrack[] = []

  for (let t = 0; t < trackCount && !r.done; t++) {
    const id = r.str(4)
    const len = r.u32()
    const end = r.pos + len
    if (id !== 'MTrk') {
      r.pos = end
      continue
    }
    const track: RawTrack = { name: '', channels: new Map(), programs: new Map() }
    const open = new Map<string, { start: number; velocity: number }[]>() // "canal:nota" -> pilha
    let tick = 0
    let status = 0
    while (r.pos < end) {
      tick += r.vlq()
      let byte = r.u8()
      if (byte < 0x80) {
        r.pos-- // running status: reaproveita o status anterior
        byte = status
      } else if (byte < 0xf0) {
        status = byte
      }
      const type = byte & 0xf0
      const ch = byte & 0x0f
      if (byte === 0xff) {
        const metaType = r.u8()
        const metaLen = r.vlq()
        const data = r.bytes(metaLen)
        if (metaType === 0x51 && !bpm) bpm = 60_000_000 / ((data[0] << 16) | (data[1] << 8) | data[2])
        else if (metaType === 0x58 && !beatsPerBar) beatsPerBar = Math.max(1, Math.round((data[0] * 4) / 2 ** data[1]))
        else if (metaType === 0x03 && !track.name) track.name = new TextDecoder('latin1').decode(data).trim()
      } else if (byte === 0xf0 || byte === 0xf7) {
        r.pos += r.vlq() // SysEx
      } else if (type === 0x90 || type === 0x80) {
        const pitch = r.u8()
        const velocity = r.u8()
        const key = `${ch}:${pitch}`
        if (type === 0x90 && velocity > 0) {
          open.set(key, [...(open.get(key) ?? []), { start: tick, velocity }])
        } else {
          const stack = open.get(key)
          const on = stack?.shift()
          if (on) {
            const notes = track.channels.get(ch) ?? []
            notes.push(createNote(pitch, on.start / ppq, Math.max(1, tick - on.start) / ppq, on.velocity / 127))
            track.channels.set(ch, notes)
          }
        }
      } else if (type === 0xc0) {
        const program = r.u8()
        if (!track.programs.has(ch)) track.programs.set(ch, program)
      } else if (type === 0xd0) {
        r.pos += 1
      } else {
        r.pos += 2 // 0xA0 aftertouch, 0xB0 controle, 0xE0 pitch bend
      }
    }
    r.pos = end
    tracks.push(track)
  }

  const project: Project = {
    ...createEmptyProject(),
    name: fileName.replace(/\.(mid|midi)$/i, ''),
    bpm: Math.round(Math.min(300, Math.max(20, bpm || 120))),
    beatsPerBar: beatsPerBar || 4,
  }

  // Uma faixa por (trilha, canal) com notas.
  for (const raw of tracks) {
    for (const [ch, notes] of raw.channels) {
      if (!notes.length) continue
      const drums = ch === 9
      const program = raw.programs.get(ch) ?? 0
      const instrumentId = drums
        ? 'drums'
        : fitInstrumentToRange(
            (raw.name && instrumentForName(raw.name)) || instrumentForProgram(program),
            notes.map((n) => n.pitch),
          )
      const name = raw.name || (drums ? 'Bateria' : `Canal ${ch + 1}`)
      const track = createTrack(name, instrumentId, {}, project.tracks.length)
      track.notes = drums
        ? notes.flatMap((n) => {
            const pitch = mapDrumNote(n.pitch)
            return pitch === undefined ? [] : [{ ...n, pitch, duration: 0.25 }]
          })
        : notes
      if (track.notes.length) project.tracks.push(track)
    }
  }
  if (!project.tracks.length) throw new Error('O arquivo MIDI não tem notas.')

  const lastEnd = Math.max(...project.tracks.flatMap((t) => t.notes.map((n) => n.start + n.duration)))
  project.lengthBars = Math.min(512, Math.max(1, Math.ceil(lastEnd / project.beatsPerBar)))
  return project
}
