import { describe, expect, it } from 'vitest'
import { EXAMPLES } from '../model/examples'
import { createNote } from '../model/project'
import { detectFifths, spell } from './key'
import { buildMidi } from './midi'
import { buildMusicXml, type PartKind } from './musicxml'
import { decompose, DIV, splitVoices, toChords, voiceToMeasures } from './quantize'

describe('quantização e figuras', () => {
  it('quebra durações em figuras alinhadas ao tempo', () => {
    expect(decompose(0, 16).map((p) => p.type)).toEqual(['whole'])
    expect(decompose(0, 6).map((p) => [p.type, p.dots])).toEqual([['quarter', 1]])
    // semicolcheia no contratempo + colcheia: não começa figura pontuada fora do tempo
    expect(decompose(1, 3).map((p) => p.type)).toEqual(['16th', 'eighth'])
    expect(decompose(2, 4).map((p) => p.type)).toEqual(['eighth', 'eighth'])
  })

  it('nota que atravessa a barra vira duas ligadas', () => {
    const chords = toChords([createNote(60, 3, 2)]) // começa no 4º tempo, dura 2 batidas (4/4)
    const measures = voiceToMeasures(chords, 4 * DIV, 2)
    const n1 = measures[0].find((e) => e.pitches.length)!
    const n2 = measures[1].find((e) => e.pitches.length)!
    expect([n1.type, n1.tieStart, n1.tieStop]).toEqual(['quarter', true, false])
    expect([n2.type, n2.tieStart, n2.tieStop]).toEqual(['quarter', false, true])
  })

  it('acordes ficam juntos; nota longa sob melodia vira segunda voz', () => {
    const notes = [createNote(48, 0, 4), createNote(64, 0, 1), createNote(67, 0, 1), createNote(65, 1, 1)]
    const voices = splitVoices(toChords(notes))
    expect(voices).toHaveLength(2)
    expect(voices.some((v) => v[0].pitches.join() === '64,67')).toBe(true)
  })

  it('sobreposição pequena (legato) encurta a nota anterior em vez de criar voz', () => {
    const voices = splitVoices(toChords([createNote(60, 0, 1.25), createNote(62, 1, 1)]))
    expect(voices).toHaveLength(1)
    expect(voices[0][0].end).toBe(1 * DIV)
  })
})

describe('armadura e grafia', () => {
  it('detecta Ré maior e Fá maior', () => {
    const d = [62, 64, 66, 67, 69, 71, 73].map((pitch) => ({ pitch, weight: 1 }))
    const f = [65, 67, 69, 70, 72, 74, 76].map((pitch) => ({ pitch, weight: 1 }))
    expect(detectFifths(d)).toBe(2)
    expect(detectFifths(f)).toBe(-1)
  })

  it('usa bemol em tons de bemóis', () => {
    expect(spell(70, -1)).toEqual({ step: 'B', alter: -1, octave: 4 })
    expect(spell(70, 2)).toEqual({ step: 'A', alter: 1, octave: 4 })
  })
})

/** Soma as durações de cada voz (blocos separados por <backup>) em cada compasso. */
function measureDurations(xml: string): number[][] {
  return [...xml.matchAll(/<measure number="\d+">(.*?)<\/measure>/g)].map(([, body]) =>
    body.split(/<backup>.*?<\/backup>/).map((block) =>
      [...block.matchAll(/<note>(.*?)<\/note>/g)]
        .filter(([, n]) => !n.startsWith('<chord/>'))
        .reduce((sum, [, n]) => sum + Number(/<duration>(\d+)<\/duration>/.exec(n)![1]), 0),
    ),
  )
}

describe('MusicXML', () => {
  for (const example of EXAMPLES) {
    it(`${example.name}: todo compasso de toda voz fecha a duração certa`, () => {
      const p = example.create()
      const kind = (id: string): PartKind => (id === 'drums' ? 'drums' : id === 'sample:piano' ? 'piano' : 'melodic')
      const xml = buildMusicXml({
        title: p.name,
        bpm: p.bpm,
        beatsPerBar: p.beatsPerBar,
        parts: p.tracks.map((t) => ({ name: t.name, kind: kind(t.instrumentId), notes: t.notes })),
      })
      expect(xml).toContain('<score-partwise version="4.0">')
      for (const blocks of measureDurations(xml)) for (const d of blocks) expect(d).toBe(p.beatsPerBar * DIV)
    })
  }

  it('escapa caracteres especiais no título', () => {
    const xml = buildMusicXml({ title: 'A & B <teste>', bpm: 120, beatsPerBar: 4, parts: [] })
    expect(xml).toContain('A &amp; B &lt;teste&gt;')
  })
})

describe('MIDI', () => {
  it('gera cabeçalho tipo 1 com uma faixa de condução + uma por faixa', () => {
    const bytes = buildMidi({
      bpm: 120,
      beatsPerBar: 4,
      tracks: [{ name: 'Piano', notes: [createNote(60, 0, 1)], channel: 0, program: 0, volume: 0.8 }],
    })
    const str = (o: number, n: number) => String.fromCharCode(...bytes.slice(o, o + n))
    expect(str(0, 4)).toBe('MThd')
    expect(bytes[9]).toBe(1) // formato 1
    expect(bytes[11]).toBe(2) // 2 faixas
    expect((bytes[12] << 8) | bytes[13]).toBe(480)
    // tempo: 500000 µs por semínima a 120 BPM
    const tempoAt = bytes.findIndex((b, i) => b === 0xff && bytes[i + 1] === 0x51)
    expect([...bytes.slice(tempoAt + 3, tempoAt + 6)]).toEqual([0x07, 0xa1, 0x20])
  })
})
