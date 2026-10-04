import { describe, expect, it } from 'vitest'
import { applyMacros, BUILDER_DEFAULTS, BUILDER_PARAMS, BUILDER_TEMPLATES, varyParams } from './builderParams'

describe('construtor de timbres', () => {
  it('todo modelo define todos os parâmetros', () => {
    for (const template of BUILDER_TEMPLATES) {
      for (const spec of BUILDER_PARAMS) expect(template.params[spec.key], `${template.id}.${spec.key}`).toBeDefined()
    }
  })

  it('macros no meio não mudam nada', () => {
    expect(applyMacros(BUILDER_DEFAULTS)).toEqual(BUILDER_DEFAULTS)
  })

  it('brilho no máximo abre o filtro 2 oitavas; espaço respeita os limites', () => {
    const out = applyMacros({ ...BUILDER_DEFAULTS, mBright: 1, mSpace: 1, reverbMix: 0.9 })
    expect(out.cutoff).toBeCloseTo(Number(BUILDER_DEFAULTS.cutoff) * 4)
    expect(out.reverbMix).toBe(1)
  })

  it('suavidade no mínimo deixa o ataque mais curto, sem passar do mínimo', () => {
    const out = applyMacros({ ...BUILDER_DEFAULTS, mAttack: 0 })
    expect(out.attack).toBe(0.001)
  })

  it('variar não liga o que está desligado nem sai das faixas', () => {
    const out = varyParams(BUILDER_DEFAULTS, 0.5, () => 1)
    expect(out.osc2Level).toBe(0)
    expect(out.drive).toBe(0)
    for (const spec of BUILDER_PARAMS) {
      if (spec.type === 'number') {
        expect(Number(out[spec.key])).toBeGreaterThanOrEqual(spec.min)
        expect(Number(out[spec.key])).toBeLessThanOrEqual(spec.max)
      }
    }
  })
})
