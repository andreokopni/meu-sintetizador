import { useEffect, useRef } from 'react'
import { engine } from '../audio/engine'
import { useProjectStore } from '../store/useProjectStore'

/**
 * Laço de desenho para canvas: redesenha quando `invalidate()` é chamado,
 * quando o projeto/seleção muda e a cada quadro durante a reprodução.
 * Também ajusta a resolução do canvas ao tamanho do elemento (com DPR).
 */
export function useCanvasLoop(
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawRef = useRef(draw)
  drawRef.current = draw
  const dirty = useRef(true)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    let frame = 0
    let size = { w: 0, h: 0 }

    const observer = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      size = { w: rect.width, h: rect.height }
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
      dirty.current = true
    })
    observer.observe(canvas)

    const unsubscribe = useProjectStore.subscribe(() => {
      dirty.current = true
    })

    const loop = () => {
      if ((dirty.current || engine.isPlaying) && size.w > 0) {
        dirty.current = false
        const dpr = window.devicePixelRatio || 1
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        drawRef.current(ctx, size.w, size.h)
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      unsubscribe()
    }
  }, [])

  return {
    canvasRef,
    invalidate: () => {
      dirty.current = true
    },
  }
}

/** Posição do cursor de reprodução em batidas. */
export function playheadBeat(): number {
  const { isPlaying, playStart } = useProjectStore.getState()
  return isPlaying ? engine.getPositionBeats() : playStart
}
