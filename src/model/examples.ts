// Músicas de exemplo — composições em domínio público (autores mortos há mais de 70 anos;
// as obras têm mais de 200 anos). Os arranjos foram escritos para este app.
// Sem Tone.js aqui (testável): as notas de bateria seguem o General MIDI.

import { BUILDER_TEMPLATES } from '../audio/instruments/builderParams'
import { createEmptyProject, createNote, createTrack, type Project, type Track, type UserTimbre } from './project'

const NOTE_BASE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/** "C4" -> 60, "F#3" -> 54, "Bb2" -> 46. */
export function midi(name: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name)
  if (!m) throw new Error(`Nota inválida: ${name}`)
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0
  return (Number(m[3]) + 1) * 12 + NOTE_BASE[m[1]] + acc
}

/** [nota ou null (pausa), duração em batidas] */
type Step = [string | null, number]

/** Escreve uma melodia em sequência; devolve o tempo final. */
function melody(track: Track, steps: Step[], start = 0, velocity = 0.8, legato = 0.95): number {
  let t = start
  for (const [name, dur] of steps) {
    if (name) track.notes.push(createNote(midi(name), t, dur * legato, velocity))
    t += dur
  }
  return t
}

function chord(track: Track, names: string[], start: number, dur: number, velocity = 0.6) {
  for (const name of names) track.notes.push(createNote(midi(name), start, dur, velocity))
}

const DRUM = { kick: 36, snare: 38, closedHat: 42, openHat: 46, crash: 49 }

// ---------------------------------------------------------------------------
// 1. Ode à Alegria — Ludwig van Beethoven (Sinfonia nº 9, 1824)
// ---------------------------------------------------------------------------
function odeToJoy(): Project {
  const p: Project = { ...createEmptyProject(), name: 'Ode à Alegria (Beethoven)', bpm: 112, lengthBars: 17 }
  const flute = createTrack('Flauta', 'sample:flute', {}, 0)
  const piano = createTrack('Piano', 'sample:piano', {}, 1)
  const bass = createTrack('Baixo', 'sample:bass-electric', {}, 2)
  const drums = createTrack('Bateria', 'drums', {}, 3)

  const phraseA: Step[] = [
    ['E5', 1], ['E5', 1], ['F5', 1], ['G5', 1], ['G5', 1], ['F5', 1], ['E5', 1], ['D5', 1],
    ['C5', 1], ['C5', 1], ['D5', 1], ['E5', 1],
  ]
  const endUp: Step[] = [['E5', 1.5], ['D5', 0.5], ['D5', 2]]
  const endDown: Step[] = [['D5', 1.5], ['C5', 0.5], ['C5', 2]]
  const bridge: Step[] = [
    ['D5', 1], ['D5', 1], ['E5', 1], ['C5', 1],
    ['D5', 1], ['E5', 0.5], ['F5', 0.5], ['E5', 1], ['C5', 1],
    ['D5', 1], ['E5', 0.5], ['F5', 0.5], ['E5', 1], ['D5', 1],
    ['C5', 1], ['D5', 1], ['G4', 2],
  ]
  let t = melody(flute, [...phraseA, ...endUp, ...phraseA, ...endDown, ...bridge, ...phraseA, ...endDown], 0, 0.85)
  flute.notes.push(createNote(midi('C5'), t, 4, 0.7)) // nota final longa

  // Harmonia: um acorde por meio compasso (2 batidas)
  const C = ['C4', 'E4', 'G4']
  const G = ['B3', 'D4', 'G4']
  const roots: Record<string, string> = { C: 'C2', G: 'G1' }
  const harmony = [
    'C C', 'G G', 'C C', 'G G', 'C C', 'G G', 'C C', 'G C',
    'G G', 'G G', 'G G', 'C G', 'C C', 'G G', 'C C', 'G C', 'C C',
  ]
  harmony.forEach((bar, i) => {
    bar.split(' ').forEach((name, half) => {
      const start = i * 4 + half * 2
      chord(piano, name === 'C' ? C : G, start, 1.9, 0.5)
      bass.notes.push(createNote(midi(roots[name]), start, 1.4, 0.8))
      bass.notes.push(createNote(midi(roots[name]) + 12, start + 1.5, 0.45, 0.6))
    })
  })

  // Bateria leve: bumbo 1 e 3, caixa 2 e 4, chimbal em colcheias
  for (let bar = 0; bar < 16; bar++) {
    const b = bar * 4
    drums.notes.push(createNote(DRUM.kick, b, 0.25, 0.85), createNote(DRUM.kick, b + 2, 0.25, 0.75))
    drums.notes.push(createNote(DRUM.snare, b + 1, 0.25, 0.6), createNote(DRUM.snare, b + 3, 0.25, 0.6))
    for (let i = 0; i < 8; i++) drums.notes.push(createNote(DRUM.closedHat, b + i * 0.5, 0.25, i % 2 ? 0.35 : 0.5))
  }
  drums.notes.push(createNote(DRUM.crash, 0, 1, 0.6), createNote(DRUM.crash, 64, 1, 0.6), createNote(DRUM.kick, 64, 0.25, 0.9))

  p.tracks = [flute, piano, bass, drums]
  return p
}

// ---------------------------------------------------------------------------
// 2. Brilha, Brilha Estrelinha — melodia tradicional francesa ("Ah! vous dirai-je, maman", séc. XVIII)
// ---------------------------------------------------------------------------
const MUSIC_BOX: UserTimbre = {
  id: 'user:exemplo-caixinha',
  name: 'Caixinha de música (exemplo)',
  baseInstrumentId: 'builder',
  params: {
    ...BUILDER_TEMPLATES.find((t) => t.id === 'keys')!.params,
    osc1Wave: 'sine', osc1Level: 0.8,
    osc2Wave: 'sine', osc2Level: 0.25, osc2Octave: 2, osc2Fine: 0,
    cutoff: 7000, filterEnv: 0, attack: 0.002, decay: 1.4, sustain: 0, release: 1.2,
    tremolo: 0, chorus: 0.15, reverbMix: 0.3, reverbSize: 0.7, gain: 6,
  },
}

function twinkle(): Project {
  const p: Project = { ...createEmptyProject(), name: 'Brilha, Brilha Estrelinha (tradicional)', bpm: 96, lengthBars: 12 }
  const box = createTrack('Caixinha', MUSIC_BOX.id, {}, 0)
  const piano = createTrack('Piano', 'sample:piano', {}, 2)
  piano.volume = 0.6

  const a: Step[] = [['C5', 1], ['C5', 1], ['G5', 1], ['G5', 1], ['A5', 1], ['A5', 1], ['G5', 2],
    ['F5', 1], ['F5', 1], ['E5', 1], ['E5', 1], ['D5', 1], ['D5', 1], ['C5', 2]]
  const b: Step[] = [['G5', 1], ['G5', 1], ['F5', 1], ['F5', 1], ['E5', 1], ['E5', 1], ['D5', 2]]
  melody(box, [...a, ...b, ...b, ...a], 0, 0.8, 0.9)

  // Arpejo "baixo de Alberti" (fundamental, quinta, terça, quinta) em colcheias
  const alberti: Record<string, string[]> = {
    C: ['C3', 'G3', 'E3', 'G3'],
    F: ['F3', 'C4', 'A3', 'C4'],
    G: ['G2', 'D3', 'B2', 'D3'],
  }
  const halves = 'C C F C F C G C C F C G C F C G C C F C F C G C'.split(' ')
  halves.forEach((name, i) => {
    alberti[name].forEach((note, j) => piano.notes.push(createNote(midi(note), i * 2 + j * 0.5, 0.5, j === 0 ? 0.6 : 0.45)))
  })

  p.tracks = [box, piano]
  p.customTimbres = [MUSIC_BOX]
  return p
}

// ---------------------------------------------------------------------------
// 3. Pour Elise (Für Elise) — Ludwig van Beethoven (1810). Compasso 3/8: aqui
//    cada batida é uma colcheia (3 por compasso) e a semicolcheia vale 0,5.
// ---------------------------------------------------------------------------
function furElise(): Project {
  const p: Project = { ...createEmptyProject(), name: 'Pour Elise (Beethoven)', bpm: 150, beatsPerBar: 3, lengthBars: 17 }
  const right = createTrack('Mão direita', 'sample:piano', {}, 1)
  const left = createTrack('Mão esquerda', 'sample:piano', {}, 2)

  const s = 0.5 // semicolcheia
  const b1: Step[] = [['E5', s], ['D#5', s], ['E5', s], ['B4', s], ['D5', s], ['C5', s]]
  const b2: Step[] = [['A4', 2 * s], [null, s], ['C4', s], ['E4', s], ['A4', s]]
  const b3: Step[] = [['B4', 2 * s], [null, s], ['E4', s], ['G#4', s], ['B4', s]]
  const b4: Step[] = [['C5', 2 * s], [null, s], ['E4', s], ['E5', s], ['D#5', s]]
  const b7: Step[] = [['B4', 2 * s], [null, s], ['E4', s], ['C5', s], ['B4', s]]
  const section: Step[] = [...b1, ...b2, ...b3, ...b4, ...b1, ...b2, ...b7]
  melody(right, [
    [null, 4 * s], ['E5', s], ['D#5', s], // anacruse (compasso 0)
    ...section, ['A4', 2 * s], [null, 2 * s], ['E5', s], ['D#5', s], // 1ª vez, volta ao início
    ...section, ['A4', 6 * s], // final
  ], 0, 0.7, 1)

  // Mão esquerda: arpejos nos compassos 2-4 e 6-8 de cada seção
  const am: Step[] = [['A2', s], ['E3', s], ['A3', s], [null, 3 * s]]
  const e: Step[] = [['E2', s], ['E3', s], ['G#3', s], [null, 3 * s]]
  const rest: Step[] = [[null, 6 * s]]
  const leftSection: Step[] = [...rest, ...am, ...e, ...am, ...rest, ...am, ...e, ...am]
  // Durações exatas (semicolcheias): soa bem com a liberação do piano e fica limpo na partitura.
  melody(left, [...rest, ...leftSection, ...leftSection], 0, 0.55, 1)

  p.tracks = [right, left]
  return p
}

// ---------------------------------------------------------------------------
// 4. Cânone em Ré — Johann Pachelbel (c. 1680). Baixo ostinato de 8 acordes.
// ---------------------------------------------------------------------------
function canon(): Project {
  const p: Project = { ...createEmptyProject(), name: 'Cânone em Ré (Pachelbel)', bpm: 72, lengthBars: 21 }
  const strings = createTrack('Cordas', 'pad', {}, 0)
  const bass = createTrack('Baixo', 'sample:bass-electric', {}, 2)
  const violin = createTrack('Violino', 'sample:violin', {}, 5)
  strings.volume = 0.45

  const progression: [string, string[]][] = [
    ['D3', ['D4', 'F#4', 'A4']],
    ['A2', ['C#4', 'E4', 'A4']],
    ['B2', ['D4', 'F#4', 'B4']],
    ['F#2', ['C#4', 'F#4', 'A4']],
    ['G2', ['D4', 'G4', 'B4']],
    ['D2', ['D4', 'F#4', 'A4']],
    ['G2', ['D4', 'G4', 'B4']],
    ['A2', ['C#4', 'E4', 'A4']],
  ]
  const cycles = 5
  for (let c = 0; c < cycles; c++) {
    progression.forEach(([root, notes], i) => {
      const start = c * 16 + i * 2
      bass.notes.push(createNote(midi(root), start, 1.9, 0.75))
      chord(strings, notes, start, 2, 0.45)
    })
  }

  const melodyA: Step[] = ['F#5', 'E5', 'D5', 'C#5', 'B4', 'A4', 'B4', 'C#5'].map((n) => [n, 2])
  const melodyB: Step[] = ['D5', 'C#5', 'B4', 'A4', 'G4', 'F#4', 'G4', 'E4'].map((n) => [n, 2])
  const melodyC: Step[] = ['D5', 'F#5', 'A5', 'G5', 'F#5', 'D5', 'F#5', 'E5', 'D5', 'B4', 'D5', 'A5', 'G5', 'B5', 'A5', 'G5']
    .map((n) => [n, 1])
  melody(violin, [...melodyA, ...melodyB, ...melodyC, ...melodyA], 16, 0.75, 0.97)

  // Acorde final
  const end = cycles * 16
  bass.notes.push(createNote(midi('D2'), end, 4, 0.8))
  chord(strings, ['D4', 'F#4', 'A4'], end, 4, 0.45)
  violin.notes.push(createNote(midi('D5'), end, 4, 0.7))

  p.tracks = [strings, bass, violin]
  return p
}

export interface ExampleSong {
  id: string
  name: string
  create(): Project
}

export const EXAMPLES: ExampleSong[] = [
  { id: 'ode', name: 'Ode à Alegria — Beethoven', create: odeToJoy },
  { id: 'twinkle', name: 'Brilha, Brilha Estrelinha — tradicional', create: twinkle },
  { id: 'elise', name: 'Pour Elise — Beethoven', create: furElise },
  { id: 'canon', name: 'Cânone em Ré — Pachelbel', create: canon },
]
