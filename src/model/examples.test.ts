import { describe, expect, it } from 'vitest'
import { EXAMPLES, midi } from './examples'
import { lastNoteEnd, projectLengthBeats } from './project'
import { parseProject, serializeProject } from './serialization'

describe('músicas de exemplo', () => {
  it('converte nomes de notas', () => {
    expect(midi('C4')).toBe(60)
    expect(midi('F#3')).toBe(54)
    expect(midi('Bb2')).toBe(46)
  })

  for (const example of EXAMPLES) {
    it(`${example.name}: válida, cabe na duração e sobrevive a salvar/abrir`, () => {
      const p = example.create()
      expect(p.tracks.length).toBeGreaterThan(0)
      for (const t of p.tracks) expect(t.notes.length).toBeGreaterThan(0)
      expect(lastNoteEnd(p)).toBeLessThanOrEqual(projectLengthBeats(p))
      expect(parseProject(serializeProject(p))).toEqual(p)
    })
  }

  it('timbres embutidos referenciados pelas faixas existem no projeto', () => {
    for (const example of EXAMPLES) {
      const p = example.create()
      for (const t of p.tracks.filter((t) => t.instrumentId.startsWith('user:'))) {
        expect(p.customTimbres?.some((c) => c.id === t.instrumentId)).toBe(true)
      }
    }
  })
})
