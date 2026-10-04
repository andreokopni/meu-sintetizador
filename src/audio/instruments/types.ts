import type * as Tone from 'tone'
import type { ParamValues } from '../../model/project'

export type ParamSpec =
  | {
      key: string
      label: string
      group: string
      type: 'number'
      min: number
      max: number
      step: number
      unit?: string
      /** Escala logarítmica no controle (útil para frequências e tempos). */
      log?: boolean
    }
  | {
      key: string
      label: string
      group: string
      type: 'select'
      options: { value: string; label: string }[]
    }

/** Uma instância tocável de um instrumento, ligada a um nó de saída. */
export interface InstrumentVoice {
  /** Resolve quando o instrumento está pronto (ex.: samples carregados). */
  ready: Promise<void>
  trigger(pitch: number, time: number, duration: number, velocity: number): void
  setParams(params: ParamValues): void
  releaseAll(): void
  dispose(): void
}

export type InstrumentCategory = 'Sintetizador' | 'Sampler' | 'Bateria'

export interface InstrumentDefinition {
  id: string
  name: string
  category: InstrumentCategory
  params: ParamSpec[]
  defaults: ParamValues
  /** Faixa de notas sugerida para o piano roll rolar até ela ao abrir. */
  focusPitch: number
  /** Para baterias: nomes das peças por nota MIDI (mostrado no piano roll). */
  pitchLabels?: Record<number, string>
  create(output: Tone.InputNode, params: ParamValues): InstrumentVoice
}
