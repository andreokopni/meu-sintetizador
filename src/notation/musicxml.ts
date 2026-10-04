// Gera MusicXML 4.0 (partwise) a partir das faixas. Abre no MuseScore, Finale, Sibelius,
// Dorico e é desenhado no app pelo OpenSheetMusicDisplay.

import type { Note } from '../model/project'
import { detectFifths, spell } from './key'
import { DIV, drumChords, splitVoices, toChords, voiceToMeasures, type Chord, type NotationEvent } from './quantize'

export type PartKind = 'piano' | 'melodic' | 'drums'

export interface ScorePart {
  name: string
  kind: PartKind
  notes: Note[]
}

export interface ScoreInput {
  title: string
  bpm: number
  beatsPerBar: number
  parts: ScorePart[]
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Bateria (General MIDI) -> posição na pauta de percussão e cabeça de nota.
const DRUM_MAP: Record<number, { step: string; octave: number; head?: string }> = {
  36: { step: 'F', octave: 4 },
  37: { step: 'C', octave: 5, head: 'x' },
  38: { step: 'C', octave: 5 },
  39: { step: 'B', octave: 4, head: 'x' },
  41: { step: 'A', octave: 4 },
  42: { step: 'G', octave: 5, head: 'x' },
  45: { step: 'D', octave: 5 },
  46: { step: 'G', octave: 5, head: 'circle-x' },
  48: { step: 'E', octave: 5 },
  49: { step: 'A', octave: 5, head: 'x' },
  51: { step: 'F', octave: 5, head: 'x' },
  56: { step: 'E', octave: 5, head: 'triangle' },
}

interface StaffPlan {
  clef: string
  voices: Chord[][]
  drums: boolean
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)] ?? 60
}

function planStaves(part: ScorePart): StaffPlan[] {
  if (part.kind === 'drums') {
    const known = part.notes.filter((n) => DRUM_MAP[n.pitch])
    return [{ clef: '<sign>percussion</sign>', voices: [drumChords(known)], drums: true }]
  }
  const treble = '<sign>G</sign><line>2</line>'
  const bass = '<sign>F</sign><line>4</line>'
  if (part.kind === 'piano') {
    const high = part.notes.filter((n) => n.pitch >= 60)
    const low = part.notes.filter((n) => n.pitch < 60)
    if (high.length && low.length) {
      return [
        { clef: treble, voices: splitVoices(toChords(high)), drums: false },
        { clef: bass, voices: splitVoices(toChords(low)), drums: false },
      ]
    }
  }
  const clef = median(part.notes.map((n) => n.pitch)) >= 57 ? treble : bass
  return [{ clef, voices: splitVoices(toChords(part.notes)), drums: false }]
}

function noteXml(e: NotationEvent, voice: number, staff: number, fifths: number, drums: boolean): string {
  if (e.pitches.length === 0) {
    const rest = e.measureRest ? '<rest measure="yes"/>' : '<rest/>'
    const type = e.measureRest ? '' : `<type>${e.type}</type>${'<dot/>'.repeat(e.dots)}`
    return `<note>${rest}<duration>${e.dur}</duration><voice>${voice}</voice>${type}<staff>${staff}</staff></note>`
  }
  return e.pitches
    .map((pitch, i) => {
      let head = ''
      let pitchXml: string
      if (drums) {
        const d = DRUM_MAP[pitch]
        pitchXml = `<unpitched><display-step>${d.step}</display-step><display-octave>${d.octave}</display-octave></unpitched>`
        if (d.head) head = `<notehead>${d.head}</notehead>`
      } else {
        const sp = spell(pitch, fifths)
        pitchXml = `<pitch><step>${sp.step}</step>${sp.alter ? `<alter>${sp.alter}</alter>` : ''}<octave>${sp.octave}</octave></pitch>`
      }
      const ties = `${e.tieStop ? '<tie type="stop"/>' : ''}${e.tieStart ? '<tie type="start"/>' : ''}`
      const tied = `${e.tieStop ? '<tied type="stop"/>' : ''}${e.tieStart ? '<tied type="start"/>' : ''}`
      return (
        `<note>${i > 0 ? '<chord/>' : ''}${pitchXml}<duration>${e.dur}</duration>${ties}` +
        `<voice>${voice}</voice><type>${e.type}</type>${'<dot/>'.repeat(e.dots)}` +
        `${drums ? '<stem>up</stem>' : ''}${head}<staff>${staff}</staff>${tied ? `<notations>${tied}</notations>` : ''}</note>`
      )
    })
    .join('')
}

/** Gera o documento MusicXML completo. */
export function buildMusicXml(input: ScoreInput): string {
  const barLen = input.beatsPerBar * DIV
  const parts = input.parts.filter((p) => p.notes.length > 0)
  const lastEnd = Math.max(1, ...parts.flatMap((p) => p.notes.map((n) => n.start + n.duration)))
  const bars = Math.max(1, Math.ceil((lastEnd * DIV - 0.01) / barLen))
  const fifths = detectFifths(
    parts.filter((p) => p.kind !== 'drums').flatMap((p) => p.notes.map((n) => ({ pitch: n.pitch, weight: n.duration }))),
  )

  const partList = parts
    .map((p, i) => `<score-part id="P${i + 1}"><part-name>${esc(p.name)}</part-name></score-part>`)
    .join('')

  const partsXml = parts
    .map((part, pi) => {
      const staves = planStaves(part)
      const staffMeasures = staves.map((s) => s.voices.map((v) => voiceToMeasures(v, barLen, bars)))
      const measures: string[] = []
      for (let m = 0; m < bars; m++) {
        let xml = `<measure number="${m + 1}">`
        if (m === 0) {
          const clefs = staves.map((s, si) => `<clef number="${si + 1}">${s.clef}</clef>`).join('')
          const key = staves[0].drums ? '' : `<key><fifths>${fifths}</fifths></key>`
          xml +=
            `<attributes><divisions>${DIV}</divisions>${key}` +
            `<time><beats>${input.beatsPerBar}</beats><beat-type>4</beat-type></time>` +
            `${staves.length > 1 ? `<staves>${staves.length}</staves>` : ''}${clefs}</attributes>`
          if (pi === 0) {
            xml +=
              `<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit>` +
              `<per-minute>${Math.round(input.bpm)}</per-minute></metronome></direction-type>` +
              `<sound tempo="${Math.round(input.bpm)}"/></direction>`
          }
        }
        const blocks: string[] = []
        staves.forEach((staff, si) => {
          staffMeasures[si].forEach((voiceMeasures, vi) => {
            const events = voiceMeasures[m]
            // Vozes extras sem notas neste compasso não são escritas (evita pausas sobrando).
            if (vi > 0 && events.every((e) => e.pitches.length === 0)) return
            const voiceNumber = si * 4 + vi + 1
            blocks.push(events.map((e) => noteXml(e, voiceNumber, si + 1, fifths, staff.drums)).join(''))
          })
        })
        xml += blocks.join(`<backup><duration>${barLen}</duration></backup>`)
        if (m === bars - 1) xml += '<barline location="right"><bar-style>light-heavy</bar-style></barline>'
        measures.push(xml + '</measure>')
      }
      return `<part id="P${pi + 1}">${measures.join('')}</part>`
    })
    .join('')

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' +
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n' +
    `<score-partwise version="4.0"><work><work-title>${esc(input.title)}</work-title></work>` +
    `<identification><encoding><software>Meu Sintetizador</software></encoding></identification>` +
    `<part-list>${partList}</part-list>${partsXml}</score-partwise>`
  )
}
