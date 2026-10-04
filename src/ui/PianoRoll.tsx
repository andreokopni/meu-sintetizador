import { useEffect, useRef, useState } from 'react'
import { setPlayStart } from '../actions/transport'
import { engine } from '../audio/engine'
import { getInstrument } from '../audio/instruments/registry'
import { isBlackKey, pitchName, projectLengthBeats, type Note, type Track } from '../model/project'
import { useProjectStore } from '../store/useProjectStore'
import { playheadBeat, useCanvasLoop } from './useCanvas'

const KEY_W = 100
const RULER_H = 22
const ROW_H = 14
const MIN_PITCH = 21 // A0
const MAX_PITCH = 108 // C8
const ROWS = MAX_PITCH - MIN_PITCH + 1
const RESIZE_ZONE = 7
const MIN_ZOOM = 12
const MAX_ZOOM = 400

type Drag =
  | { kind: 'move'; hitId: string; downBeat: number; downPitch: number; originals: Note[]; lastPitch: number; changed: boolean }
  | { kind: 'resize'; originals: Note[]; anchor: Note; changed: boolean }
  | { kind: 'erase' }
  | { kind: 'marquee'; x0: number; y0: number; x1: number; y1: number; additive: string[] }

const yOfPitch = (pitch: number) => (MAX_PITCH - pitch) * ROW_H

/** Editor de notas da faixa selecionada (canvas com rolagem virtual). */
export function PianoRoll() {
  const trackId = useProjectStore((s) => s.selectedTrackId)
  const lengthBeats = useProjectStore((s) => projectLengthBeats(s.project))
  const instrumentId = useProjectStore((s) => s.project.tracks.find((t) => t.id === s.selectedTrackId)?.instrumentId)
  const [zoom, setZoom] = useState(80) // pixels por batida
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom

  const scrollerRef = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  const lastDuration = useRef(1)
  const hoverPitch = useRef<number | null>(null)

  const currentTrack = (): Track | undefined => {
    const s = useProjectStore.getState()
    return s.project.tracks.find((t) => t.id === s.selectedTrackId)
  }

  const { canvasRef, invalidate } = useCanvasLoop((ctx, w, h) => {
    const s = useProjectStore.getState()
    const track = currentTrack()
    const scroller = scrollerRef.current
    const sx = scroller?.scrollLeft ?? 0
    const sy = scroller?.scrollTop ?? 0
    const pxPerBeat = zoomRef.current
    const total = projectLengthBeats(s.project)
    const gridX = (beat: number) => KEY_W + beat * pxPerBeat - sx
    const gridY = (pitch: number) => RULER_H + yOfPitch(pitch) - sy
    const labels = track ? getInstrument(track.instrumentId).pitchLabels : undefined

    ctx.fillStyle = '#14141b'
    ctx.fillRect(0, 0, w, h)

    // Linhas das notas (teclas pretas mais escuras)
    const firstRow = Math.max(0, Math.floor(sy / ROW_H))
    const lastRow = Math.min(ROWS - 1, Math.ceil((sy + h) / ROW_H))
    for (let row = firstRow; row <= lastRow; row++) {
      const pitch = MAX_PITCH - row
      const y = gridY(pitch)
      ctx.fillStyle = labels?.[pitch] ? '#22222e' : isBlackKey(pitch) ? '#16161d' : '#1b1b24'
      ctx.fillRect(KEY_W, y, w, ROW_H)
      if (pitch % 12 === 0) {
        ctx.fillStyle = '#2f2f3d'
        ctx.fillRect(KEY_W, y + ROW_H - 1, w, 1)
      }
    }

    // Fora da música
    const endX = gridX(total)
    if (endX < w) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.fillRect(Math.max(KEY_W, endX), RULER_H, w, h)
    }

    // Grade vertical
    const firstBeat = Math.max(0, sx / pxPerBeat)
    const lastBeat = Math.min(total, (sx + w) / pxPerBeat)
    const snapPx = s.snap * pxPerBeat
    if (snapPx >= 6) {
      ctx.fillStyle = '#20202a'
      for (let b = Math.floor(firstBeat / s.snap) * s.snap; b <= lastBeat; b += s.snap) {
        ctx.fillRect(Math.round(gridX(b)), RULER_H, 1, h)
      }
    }
    for (let b = Math.floor(firstBeat); b <= lastBeat; b++) {
      ctx.fillStyle = b % s.project.beatsPerBar === 0 ? '#3a3a4c' : '#2a2a37'
      ctx.fillRect(Math.round(gridX(b)), RULER_H, 1, h)
    }

    // Notas das outras faixas (fantasmas)
    for (const other of s.project.tracks) {
      if (other.id === track?.id) continue
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
      for (const n of other.notes) {
        const x = gridX(n.start)
        if (x > w || x + n.duration * pxPerBeat < KEY_W) continue
        ctx.fillRect(x, gridY(n.pitch) + 1, n.duration * pxPerBeat, ROW_H - 2)
      }
    }

    // Notas da faixa
    if (track) {
      const selected = new Set(s.selectedNoteIds)
      for (const n of track.notes) {
        const x = gridX(n.start)
        const nw = Math.max(3, n.duration * pxPerBeat - 1)
        if (x > w || x + nw < KEY_W) continue
        const y = gridY(n.pitch)
        if (y > h || y + ROW_H < RULER_H) continue
        ctx.globalAlpha = 0.45 + n.velocity * 0.55
        ctx.fillStyle = track.color
        ctx.fillRect(x, y + 1, nw, ROW_H - 2)
        ctx.globalAlpha = 1
        ctx.strokeStyle = selected.has(n.id) ? '#ffffff' : 'rgba(0,0,0,0.45)'
        ctx.lineWidth = selected.has(n.id) ? 1.5 : 1
        ctx.strokeRect(x + 0.5, y + 1.5, nw - 1, ROW_H - 3)
        if (nw > 34 && !labels) {
          ctx.fillStyle = 'rgba(0,0,0,0.6)'
          ctx.font = '10px Segoe UI, sans-serif'
          ctx.fillText(pitchName(n.pitch), x + 3, y + ROW_H - 3)
        }
      }
    }

    // Seleção retangular
    const d = drag.current
    if (d?.kind === 'marquee') {
      ctx.strokeStyle = '#a395ff'
      ctx.fillStyle = 'rgba(124,108,255,0.15)'
      const x = Math.min(d.x0, d.x1) - sx + KEY_W
      const y = Math.min(d.y0, d.y1) - sy + RULER_H
      ctx.fillRect(x, y, Math.abs(d.x1 - d.x0), Math.abs(d.y1 - d.y0))
      ctx.strokeRect(x + 0.5, y + 0.5, Math.abs(d.x1 - d.x0), Math.abs(d.y1 - d.y0))
    }

    // Cursor de reprodução
    const px = gridX(playheadBeat())
    if (px >= KEY_W) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(Math.round(px), RULER_H, 1, h)
    }

    // Teclado
    for (let row = firstRow; row <= lastRow; row++) {
      const pitch = MAX_PITCH - row
      const y = gridY(pitch)
      const black = isBlackKey(pitch)
      ctx.fillStyle = hoverPitch.current === pitch ? '#a395ff' : black ? '#2a2a33' : '#d9d9e3'
      ctx.fillRect(0, y, KEY_W, ROW_H)
      ctx.fillStyle = '#14141b'
      ctx.fillRect(0, y + ROW_H - 1, KEY_W, 1)
      const label = labels?.[pitch] ?? (pitch % 12 === 0 ? pitchName(pitch) : '')
      if (label) {
        ctx.fillStyle = black ? '#e6e6ef' : '#2a2a33'
        ctx.font = '10px Segoe UI, sans-serif'
        ctx.fillText(label, 4, y + ROW_H - 3)
      }
    }
    ctx.fillStyle = '#2f2f3d'
    ctx.fillRect(KEY_W - 1, RULER_H, 1, h)

    // Régua
    ctx.fillStyle = '#1c1c26'
    ctx.fillRect(0, 0, w, RULER_H)
    ctx.font = '11px Segoe UI, sans-serif'
    const barPx = s.project.beatsPerBar * pxPerBeat
    const labelEvery = Math.max(1, Math.ceil(30 / barPx))
    for (let bar = 0; bar < s.project.lengthBars; bar += labelEvery) {
      const x = gridX(bar * s.project.beatsPerBar)
      if (x < KEY_W - 20 || x > w) continue
      ctx.fillStyle = '#3a3a4c'
      ctx.fillRect(Math.round(x), 12, 1, RULER_H - 12)
      ctx.fillStyle = '#9393a8'
      if (x >= KEY_W) ctx.fillText(String(bar + 1), x + 4, 14)
    }
    if (px >= KEY_W) {
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.moveTo(px - 5, 0)
      ctx.lineTo(px + 5, 0)
      ctx.lineTo(px, 8)
      ctx.fill()
    }
    ctx.fillStyle = '#2f2f3d'
    ctx.fillRect(0, RULER_H - 1, w, 1)
    ctx.fillStyle = '#1c1c26'
    ctx.fillRect(0, 0, KEY_W - 1, RULER_H - 1)
  })

  // Ao trocar de faixa/instrumento, rola até a região de notas relevante.
  useEffect(() => {
    const scroller = scrollerRef.current
    const track = currentTrack()
    if (!scroller || !track) return
    const pitches = track.notes.map((n) => n.pitch)
    const center = pitches.length
      ? (Math.min(...pitches) + Math.max(...pitches)) / 2
      : getInstrument(track.instrumentId).focusPitch
    scroller.scrollTop = yOfPitch(Math.round(center)) - (scroller.clientHeight - RULER_H) / 2
    invalidate()
  }, [trackId, instrumentId])

  useEffect(invalidate, [zoom])

  // Ctrl + roda do mouse = zoom horizontal (precisa de listener não-passivo).
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const rect = scroller.getBoundingClientRect()
      const mouseX = e.clientX - rect.left - KEY_W
      const beatAtMouse = (mouseX + scroller.scrollLeft) / zoomRef.current
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomRef.current * (e.deltaY < 0 ? 1.15 : 1 / 1.15)))
      zoomRef.current = next
      setZoom(next)
      requestAnimationFrame(() => {
        scroller.scrollLeft = beatAtMouse * next - mouseX
      })
    }
    scroller.addEventListener('wheel', onWheel, { passive: false })
    return () => scroller.removeEventListener('wheel', onWheel)
  }, [trackId])

  // ---------- Interação ----------

  const locate = (e: React.PointerEvent) => {
    const scroller = scrollerRef.current!
    const rect = scroller.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const cx = x - KEY_W + scroller.scrollLeft // coordenadas de conteúdo
    const cy = y - RULER_H + scroller.scrollTop
    const beat = cx / zoomRef.current
    const pitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, MAX_PITCH - Math.floor(cy / ROW_H)))
    return { x, y, cx, cy, beat, pitch }
  }

  const hitTest = (track: Track, beat: number, pitch: number, cx: number) => {
    for (let i = track.notes.length - 1; i >= 0; i--) {
      const n = track.notes[i]
      if (n.pitch === pitch && beat >= n.start && beat < n.start + n.duration) {
        const endPx = (n.start + n.duration) * zoomRef.current
        const nearEnd = endPx - cx < RESIZE_ZONE && n.duration * zoomRef.current > RESIZE_ZONE * 2
        return { note: n, nearEnd }
      }
    }
    return null
  }

  const snapFloor = (beat: number) => {
    const snap = useProjectStore.getState().snap
    return Math.max(0, Math.floor(beat / snap + 1e-6) * snap)
  }
  const snapRound = (beat: number) => {
    const snap = useProjectStore.getState().snap
    return Math.round(beat / snap) * snap
  }

  const preview = (pitch: number) => {
    const track = currentTrack()
    if (track) engine.previewNote(track.id, pitch)
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const scroller = scrollerRef.current!
    // Ignora cliques nas barras de rolagem
    if (e.clientX - scroller.getBoundingClientRect().left > scroller.clientWidth) return
    if (e.clientY - scroller.getBoundingClientRect().top > scroller.clientHeight) return

    const s = useProjectStore.getState()
    const track = currentTrack()
    const p = locate(e)

    if (p.y < RULER_H) {
      setPlayStart(snapFloor(p.beat))
      return
    }
    if (p.x < KEY_W) {
      preview(p.pitch)
      return
    }
    if (!track) return
    try {
      scroller.setPointerCapture(e.pointerId)
    } catch {
      // ponteiro inválido (ex.: eventos sintéticos) — segue sem captura
    }
    const hit = hitTest(track, p.beat, p.pitch, p.cx)

    if (e.button === 2) {
      drag.current = { kind: 'erase' }
      if (hit) s.deleteNotes(track.id, [hit.note.id])
      return
    }
    if (e.button !== 0) return

    if (hit) {
      let selection = s.selectedNoteIds
      if (e.shiftKey || e.ctrlKey) {
        selection = selection.includes(hit.note.id)
          ? selection.filter((id) => id !== hit.note.id)
          : [...selection, hit.note.id]
        s.selectNotes(selection)
        if (!selection.includes(hit.note.id)) return
      } else if (!selection.includes(hit.note.id)) {
        selection = [hit.note.id]
        s.selectNotes(selection)
      }
      const originals = track.notes.filter((n) => selection.includes(n.id))
      if (hit.nearEnd) {
        drag.current = { kind: 'resize', originals, anchor: hit.note, changed: false }
      } else {
        drag.current = { kind: 'move', hitId: hit.note.id, downBeat: p.beat, downPitch: p.pitch, originals, lastPitch: p.pitch, changed: false }
        preview(hit.note.pitch)
      }
      return
    }

    if (e.shiftKey || e.ctrlKey) {
      drag.current = { kind: 'marquee', x0: p.cx, y0: p.cy, x1: p.cx, y1: p.cy, additive: s.selectedNoteIds }
      return
    }

    // Clique em área vazia: cria uma nota e permite esticá-la arrastando.
    const start = snapFloor(p.beat)
    const duration = Math.max(s.snap, lastDuration.current)
    const note = s.addNote(track.id, p.pitch, start, duration)
    s.selectNotes([note.id])
    drag.current = { kind: 'resize', originals: [note], anchor: note, changed: true }
    preview(p.pitch)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = useProjectStore.getState()
    const track = currentTrack()
    const p = locate(e)
    const d = drag.current
    const scroller = scrollerRef.current!

    const hp = p.x < KEY_W && p.y > RULER_H ? p.pitch : null
    if (hp !== hoverPitch.current) {
      hoverPitch.current = hp
      invalidate()
    }

    if (!track) return
    if (!d) {
      const hit = p.x >= KEY_W && p.y >= RULER_H ? hitTest(track, p.beat, p.pitch, p.cx) : null
      scroller.style.cursor =
        p.y < RULER_H ? 'text' : p.x < KEY_W ? 'pointer' : hit ? (hit.nearEnd ? 'ew-resize' : 'grab') : 'crosshair'
      return
    }

    if (d.kind === 'erase') {
      const hit = hitTest(track, p.beat, p.pitch, p.cx)
      if (hit) s.deleteNotes(track.id, [hit.note.id])
    } else if (d.kind === 'move') {
      const minStart = Math.min(...d.originals.map((n) => n.start))
      let dBeat = snapRound(p.beat - d.downBeat)
      dBeat = Math.max(dBeat, -minStart)
      const minPitch = Math.min(...d.originals.map((n) => n.pitch))
      const maxPitch = Math.max(...d.originals.map((n) => n.pitch))
      const dPitch = Math.min(MAX_PITCH - maxPitch, Math.max(MIN_PITCH - minPitch, p.pitch - d.downPitch))
      if (!d.changed && dBeat === 0 && dPitch === 0) return
      if (!d.changed) {
        s.checkpoint()
        d.changed = true
      }
      const changes: Record<string, Partial<Note>> = {}
      for (const n of d.originals) changes[n.id] = { start: n.start + dBeat, pitch: n.pitch + dPitch }
      s.updateNotes(track.id, changes, false)
      if (p.pitch !== d.lastPitch && dPitch !== 0) {
        d.lastPitch = p.pitch
        preview(d.originals[0].pitch + dPitch)
      }
      scroller.style.cursor = 'grabbing'
    } else if (d.kind === 'resize') {
      const newDuration = Math.max(s.snap, snapRound(p.beat - d.anchor.start))
      const delta = newDuration - d.anchor.duration
      if (!d.changed && delta === 0) return
      if (!d.changed) {
        s.checkpoint()
        d.changed = true
      }
      const changes: Record<string, Partial<Note>> = {}
      for (const n of d.originals) changes[n.id] = { duration: Math.max(s.snap, n.duration + delta) }
      s.updateNotes(track.id, changes, false)
      lastDuration.current = newDuration
    } else if (d.kind === 'marquee') {
      d.x1 = p.cx
      d.y1 = p.cy
      const b0 = Math.min(d.x0, d.x1) / zoomRef.current
      const b1 = Math.max(d.x0, d.x1) / zoomRef.current
      const pTop = MAX_PITCH - Math.floor(Math.min(d.y0, d.y1) / ROW_H)
      const pBottom = MAX_PITCH - Math.floor(Math.max(d.y0, d.y1) / ROW_H)
      const inside = track.notes
        .filter((n) => n.pitch <= pTop && n.pitch >= pBottom && n.start < b1 && n.start + n.duration > b0)
        .map((n) => n.id)
      s.selectNotes([...new Set([...d.additive, ...inside])])
      invalidate()
    }
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (d?.kind === 'move' && !d.changed && !e.shiftKey && !e.ctrlKey) {
      // Clique simples (sem arrastar) numa nota de uma seleção múltipla: seleciona só ela.
      useProjectStore.getState().selectNotes([d.hitId])
    }
    if (d?.kind === 'move') {
      const hit = currentTrack()?.notes.find((n) => n.id === d.hitId)
      if (hit) lastDuration.current = hit.duration
    }
    drag.current = null
    invalidate()
  }

  const contentW = KEY_W + lengthBeats * zoom + 200
  const contentH = RULER_H + ROWS * ROW_H

  return (
    <div className="piano-roll">
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
      <div
        className="scroller"
        ref={scrollerRef}
        onScroll={invalidate}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          if (hoverPitch.current !== null) {
            hoverPitch.current = null
            invalidate()
          }
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div style={{ width: contentW, height: contentH }} />
      </div>
      {!trackId && <div className="empty">Adicione uma faixa para começar a compor.</div>}
      <div className="hint">
        Clique: criar · Arrastar: mover/esticar · Botão direito: apagar · Shift+arrastar: selecionar · Ctrl+roda: zoom
      </div>
    </div>
  )
}
