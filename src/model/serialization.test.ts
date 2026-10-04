import { describe, expect, it } from 'vitest'
import { createEmptyProject, createNote, createTrack, PROJECT_VERSION } from './project'
import { parseProject, serializeProject } from './serialization'

describe('serialização de projeto', () => {
  it('ida e volta preserva o conteúdo', () => {
    const project = createEmptyProject()
    const track = createTrack('Piano', 'sample:piano', { release: 1.5 }, 0)
    track.notes.push(createNote(60, 0, 1), createNote(64, 1, 0.5, 0.6))
    track.solo = true
    project.tracks.push(track)

    expect(parseProject(serializeProject(project))).toEqual(project)
  })

  it('preserva timbres do usuário embutidos e descarta inválidos', () => {
    const project = createEmptyProject()
    project.customTimbres = [{ id: 'user:abc', name: 'Meu lead', baseInstrumentId: 'builder', params: { cutoff: 900 } }]
    expect(parseProject(serializeProject(project)).customTimbres).toEqual(project.customTimbres)

    const raw = JSON.parse(serializeProject(project))
    raw.customTimbres.push({ id: 'sem-prefixo', baseInstrumentId: 'lead' }, { id: 'user:x' })
    expect(parseProject(JSON.stringify(raw)).customTimbres).toHaveLength(1)
  })

  it('rejeita arquivos que não são projetos', () => {
    expect(() => parseProject('não é json')).toThrow(/JSON/)
    expect(() => parseProject('{"tracks": []}')).toThrow(/não é um projeto/)
  })

  it('rejeita projetos de versões futuras', () => {
    const text = JSON.stringify({ format: 'meu-sintetizador', version: PROJECT_VERSION + 1, tracks: [] })
    expect(() => parseProject(text)).toThrow(/versão mais nova/)
  })

  it('corrige valores inválidos e descarta notas quebradas', () => {
    const text = JSON.stringify({
      format: 'meu-sintetizador',
      version: 1,
      bpm: 9999,
      tracks: [
        {
          name: 'X',
          volume: 5,
          params: { cutoff: 1000, bad: { nested: true } },
          notes: [{ pitch: 200, start: -3, duration: 1 }, { pitch: 60, start: 0, duration: 0 }, null],
        },
      ],
    })
    const p = parseProject(text)
    expect(p.bpm).toBe(300)
    expect(p.tracks[0].volume).toBe(1)
    expect(p.tracks[0].params).toEqual({ cutoff: 1000 })
    expect(p.tracks[0].notes).toHaveLength(1)
    expect(p.tracks[0].notes[0]).toMatchObject({ pitch: 127, start: 0, duration: 1, velocity: 0.8 })
  })
})
