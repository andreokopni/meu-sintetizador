// Baixa um conjunto enxuto de samples (CC-BY 3.0) para public/samples e gera manifest.json.
// Uso: node scripts/fetch-samples.mjs
import fs from 'node:fs/promises'
import path from 'node:path'

const OUT = path.resolve('public/samples')
const NAMES = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B']
const TONEJS_INSTRUMENTS = 'https://nbrosowsky.github.io/tonejs-instruments/samples'

const INSTRUMENTS = [
  { id: 'piano', name: 'Piano acústico', base: 'https://tonejs.github.io/audio/salamander', octaves: [1, 7], release: 1.2 },
  { id: 'guitar', name: 'Violão', base: `${TONEJS_INSTRUMENTS}/guitar-acoustic`, octaves: [2, 5], release: 1 },
  { id: 'violin', name: 'Violino', base: `${TONEJS_INSTRUMENTS}/violin`, octaves: [3, 7], release: 0.6 },
  { id: 'flute', name: 'Flauta', base: `${TONEJS_INSTRUMENTS}/flute`, octaves: [4, 7], release: 0.4 },
  { id: 'bass-electric', name: 'Baixo elétrico', base: `${TONEJS_INSTRUMENTS}/bass-electric`, octaves: [1, 5], release: 0.5 },
]

/** Espaçamento mínimo (semitons) entre samples mantidos; o Sampler interpola o resto. */
const MIN_GAP = 3

function midi(name, octave) {
  return (octave + 1) * 12 + NAMES.indexOf(name)
}

async function exists(url) {
  const res = await fetch(url, { method: 'HEAD' })
  return res.ok
}

async function main() {
  const manifest = { instruments: [] }
  for (const inst of INSTRUMENTS) {
    const candidates = []
    for (let o = inst.octaves[0]; o <= inst.octaves[1]; o++) {
      for (const n of NAMES) candidates.push({ note: `${n}${o}`, midi: midi(n, o), url: `${inst.base}/${n}${o}.mp3` })
    }
    const found = (await Promise.all(candidates.map(async (c) => ((await exists(c.url)) ? c : null)))).filter(Boolean)
    found.sort((a, b) => a.midi - b.midi)
    const keep = []
    for (const c of found) if (!keep.length || c.midi - keep[keep.length - 1].midi >= MIN_GAP) keep.push(c)

    const dir = path.join(OUT, inst.id)
    await fs.mkdir(dir, { recursive: true })
    const files = {}
    for (const c of keep) {
      const res = await fetch(c.url)
      if (!res.ok) continue
      await fs.writeFile(path.join(dir, `${c.note}.mp3`), Buffer.from(await res.arrayBuffer()))
      // Nome no formato do Tone.js: "Ds4" -> "D#4"
      files[c.note.replace('s', '#')] = `${c.note}.mp3`
    }
    manifest.instruments.push({ id: inst.id, name: inst.name, folder: inst.id, release: inst.release, files })
    console.log(`${inst.name}: ${Object.keys(files).length} samples`)
  }
  await fs.writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
