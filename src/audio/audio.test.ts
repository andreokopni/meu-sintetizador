import { describe, expect, it } from 'vitest'
import { createTrack } from '../model/project'
import { isTrackAudible, volumeToDb } from './mixLogic'
import { encodeWav } from './wav'

describe('mute / solo', () => {
  const make = (mute = false, solo = false) => ({ ...createTrack('t', 'lead', {}, 0), mute, solo })

  it('sem solo, só as mudas ficam em silêncio', () => {
    const tracks = [make(), make(true)]
    expect(tracks.map((t) => isTrackAudible(t, tracks))).toEqual([true, false])
  })

  it('com solo, só as faixas em solo tocam', () => {
    const tracks = [make(), make(false, true), make(false, true)]
    expect(tracks.map((t) => isTrackAudible(t, tracks))).toEqual([false, true, true])
  })

  it('mudo vence solo', () => {
    const tracks = [make(true, true), make()]
    expect(tracks.map((t) => isTrackAudible(t, tracks))).toEqual([false, false])
  })

  it('converte volume para dB', () => {
    expect(volumeToDb(1)).toBe(0)
    expect(volumeToDb(0)).toBe(-Infinity)
    expect(volumeToDb(0.5)).toBeCloseTo(-6.02, 1)
  })
})

describe('encodeWav', () => {
  it('gera cabeçalho e amostras PCM 16 bits corretos', () => {
    const left = new Float32Array([0, 1, -1, 0.5])
    const right = new Float32Array([0, -1, 1, 2]) // 2 deve ser limitado a 1
    const wav = encodeWav({ numberOfChannels: 2, sampleRate: 44100, length: 4, getChannelData: (c) => (c ? right : left) })
    const view = new DataView(wav)
    const text = (o: number, n: number) => String.fromCharCode(...new Uint8Array(wav, o, n))

    expect(wav.byteLength).toBe(44 + 4 * 2 * 2)
    expect(text(0, 4)).toBe('RIFF')
    expect(text(8, 4)).toBe('WAVE')
    expect(view.getUint16(22, true)).toBe(2)
    expect(view.getUint32(24, true)).toBe(44100)
    expect(view.getUint32(40, true)).toBe(16)
    // Amostra 1: L = 1 -> 32767, R = -1 -> -32768
    expect(view.getInt16(44 + 4, true)).toBe(32767)
    expect(view.getInt16(44 + 6, true)).toBe(-32768)
    // Amostra 3: R = 2 -> limitado a 32767
    expect(view.getInt16(44 + 14, true)).toBe(32767)
  })
})
