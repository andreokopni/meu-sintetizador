// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { EXAMPLES } from '../model/examples'
import { createNote } from '../model/project'
import { fitInstrumentToRange, mapDrumNote } from './gm'
import { importMidi } from './importMidi'
import { importMusicXml } from './importMusicXml'
import { buildMidi } from './midi'
import { buildMusicXml, type PartKind } from './musicxml'
import { readMxl } from './unzip'

const kind = (id: string): PartKind => (id === 'drums' ? 'drums' : id === 'sample:piano' ? 'piano' : 'melodic')
const sig = (notes: { pitch: number; start: number; duration: number }[]) =>
  notes
    .map((n) => `${n.pitch}@${Math.round(n.start * 4)}+${Math.round(n.duration * 4)}`)
    .sort()
    .join(' ')

describe('importar MusicXML', () => {
  it('ida e volta: exportar e importar a Ode à Alegria preserva notas, andamento e compasso', () => {
    const p = EXAMPLES.find((e) => e.id === 'ode')!.create()
    const xml = buildMusicXml({
      title: p.name,
      bpm: p.bpm,
      beatsPerBar: p.beatsPerBar,
      parts: p.tracks.map((t) => ({ name: t.name, kind: kind(t.instrumentId), notes: t.notes })),
    })
    const back = importMusicXml(xml)
    expect(back.name).toBe(p.name)
    expect(back.bpm).toBe(p.bpm)
    expect(back.beatsPerBar).toBe(4)
    expect(back.tracks.map((t) => t.instrumentId)).toEqual(['sample:flute', 'sample:piano', 'sample:bass-electric', 'drums'])
    // melodia (quantizada para semicolcheia) idêntica
    const flute = p.tracks[0].notes.map((n) => ({ ...n, duration: Math.round(n.duration * 4) / 4 }))
    expect(sig(back.tracks[0].notes)).toBe(sig(flute))
  })

  it('junta notas ligadas e trata acordes, backup e anacruse', () => {
    const xml = `<?xml version="1.0"?><score-partwise version="4.0">
      <part-list><score-part id="P1"><part-name>Violino</part-name></score-part></part-list>
      <part id="P1">
        <measure number="0" implicit="yes"><attributes><divisions>2</divisions><time><beats>3</beats><beat-type>4</beat-type></time></attributes>
          <note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice></note>
        </measure>
        <measure number="1">
          <note><pitch><step>C</step><octave>5</octave></pitch><duration>6</duration><tie type="start"/><voice>1</voice></note>
          <note><chord/><pitch><step>E</step><alter>-1</alter><octave>5</octave></pitch><duration>6</duration><voice>1</voice></note>
          <backup><duration>6</duration></backup>
          <note><pitch><step>C</step><octave>3</octave></pitch><duration>6</duration><voice>2</voice></note>
        </measure>
        <measure number="2">
          <note><pitch><step>C</step><octave>5</octave></pitch><duration>2</duration><tie type="stop"/><voice>1</voice></note>
          <note><rest/><duration>4</duration><voice>1</voice></note>
        </measure>
      </part></score-partwise>`
    const p = importMusicXml(xml)
    expect(p.beatsPerBar).toBe(3)
    expect(p.tracks[0].instrumentId).toBe('sample:violin')
    // anacruse de 1 batida; C5 ligado = 3 + 1 batidas
    expect(sig(p.tracks[0].notes)).toBe(sig([createNote(67, 0, 1), createNote(72, 1, 4), createNote(75, 1, 3), createNote(48, 1, 3)]))
  })

  it('rejeita arquivos que não são MusicXML', () => {
    expect(() => importMusicXml('<html></html>')).toThrow(/não é uma partitura/)
  })
})

describe('importar MIDI', () => {
  it('ida e volta com o exportador: notas, andamento, bateria no canal 10', () => {
    const bytes = buildMidi({
      bpm: 90,
      beatsPerBar: 3,
      tracks: [
        { name: 'Flauta', notes: [createNote(72, 0, 1, 0.5), createNote(74, 1, 0.5)], channel: 0, program: 73, volume: 1 },
        { name: 'Ritmo', notes: [createNote(35, 0, 0.25), createNote(42, 0.5, 0.25)], channel: 9, program: 0, volume: 1 },
      ],
    })
    const p = importMidi(bytes.buffer as ArrayBuffer, 'teste.mid')
    expect(p.name).toBe('teste')
    expect(p.bpm).toBe(90)
    expect(p.beatsPerBar).toBe(3)
    expect(p.tracks.map((t) => t.instrumentId)).toEqual(['sample:flute', 'drums'])
    expect(sig(p.tracks[0].notes)).toBe(sig([createNote(72, 0, 1), createNote(74, 1, 0.5)]))
    expect(p.tracks[0].notes[0].velocity).toBeCloseTo(0.5, 1)
    // bumbo acústico (35) vira o bumbo do kit (36)
    expect(p.tracks[1].notes.map((n) => n.pitch)).toEqual([36, 42])
  })

  it('instrumento cuja extensão não cobre as notas vira Pad (ex.: violoncelo no violino)', () => {
    expect(fitInstrumentToRange('sample:violin', [37, 40, 43, 45, 48, 52, 55, 60])).toBe('pad')
    expect(fitInstrumentToRange('sample:violin', [67, 69, 72, 76])).toBe('sample:violin')
    expect(fitInstrumentToRange('lead', [10, 20])).toBe('lead')
  })

  it('peças de percussão GM fora do kit vão para a mais próxima', () => {
    expect(mapDrumNote(40)).toBe(38)
    expect(mapDrumNote(36)).toBe(36)
    expect(mapDrumNote(20)).toBeUndefined()
  })
})

/** Monta um ZIP mínimo (para testar o leitor de .mxl). */
async function makeZip(files: { name: string; text: string; deflate: boolean }[]): Promise<ArrayBuffer> {
  const enc = new TextEncoder()
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const f of files) {
    const raw = enc.encode(f.text)
    const data = f.deflate
      ? new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer())
      : raw
    const name = enc.encode(f.name)
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(8, f.deflate ? 8 : 0, true)
    local.setUint32(18, data.length, true)
    local.setUint32(22, raw.length, true)
    local.setUint16(26, name.length, true)
    parts.push(new Uint8Array(local.buffer), name, data)
    const c = new DataView(new ArrayBuffer(46))
    c.setUint32(0, 0x02014b50, true)
    c.setUint16(10, f.deflate ? 8 : 0, true)
    c.setUint32(20, data.length, true)
    c.setUint32(24, raw.length, true)
    c.setUint16(28, name.length, true)
    c.setUint32(42, offset, true)
    central.push(new Uint8Array(c.buffer), name)
    offset += 30 + name.length + data.length
  }
  const centralSize = central.reduce((s, b) => s + b.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, files.length, true)
  end.setUint16(10, files.length, true)
  end.setUint32(12, centralSize, true)
  end.setUint32(16, offset, true)
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)] as BlobPart[]).arrayBuffer()
}

describe('.mxl (MusicXML compactado)', () => {
  it('segue o container.xml e descompacta deflate', async () => {
    const zip = await makeZip([
      { name: 'META-INF/container.xml', text: '<container><rootfiles><rootfile full-path="score.xml"/></rootfiles></container>', deflate: false },
      { name: 'score.xml', text: '<score-partwise>conteúdo</score-partwise>', deflate: true },
    ])
    expect(await readMxl(zip)).toBe('<score-partwise>conteúdo</score-partwise>')
  })
})
