import { describe, expect, it } from 'vitest'
import { clampRowDelta, createLayout, MAX_PITCH, rowAtY, shiftPitch } from './rollLayout'

describe('layout do piano roll', () => {
  it('modo melódico: linha 0 é C8 e subir uma linha sobe um semitom', () => {
    const l = createLayout()
    expect(l.drum).toBe(false)
    expect(l.rows[0]).toBe(MAX_PITCH)
    expect(l.indexOf(60)).toBe(MAX_PITCH - 60)
    expect(shiftPitch(l, 60, -2)).toBe(62)
    expect(rowAtY(l, -50)).toBe(0)
  })

  it('modo bateria: só as peças do kit, na ordem definida', () => {
    const l = createLayout({ rows: [49, 42, 38, 36], pitchLabels: { 36: 'Bumbo' } })
    expect(l.drum).toBe(true)
    expect(l.indexOf(36)).toBe(3)
    expect(l.indexOf(60)).toBe(-1)
    expect(rowAtY(l, l.rowH * 2.5)).toBe(2)
    expect(rowAtY(l, 99999)).toBe(3)
    // Bumbo (linha 3) sobe uma linha -> Caixa
    expect(shiftPitch(l, 36, -1)).toBe(38)
  })

  it('limita o deslocamento para nenhuma nota sair do layout', () => {
    const l = createLayout({ rows: [49, 42, 38, 36] })
    expect(clampRowDelta(l, [42, 38], -5)).toBe(-1)
    expect(clampRowDelta(l, [42, 38], 5)).toBe(1)
    // nota fora do kit não restringe
    expect(clampRowDelta(l, [60, 36], -2)).toBe(-2)
    expect(clampRowDelta(l, [60], 3)).toBe(0)
  })
})
