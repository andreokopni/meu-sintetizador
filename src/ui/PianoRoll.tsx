import { useEffect, useMemo, useRef, useState } from 'react'
import { setPlayStart } from '../actions/transport'
import { engine } from '../audio/engine'
import { getInstrument } from '../audio/instruments/registry'
import { isBlackKey, pitchName, projectLengthBeats, type Note, type Track } from '../model/project'
import { useProjectStore } from '../store/useProjectStore'
import { clampRowDelta, createLayout, rowAtY, shiftPitch, type RollLayout } from './rollLayout'
import { playheadBeat, useCanvasLoop } from './useCanvas'

const KEY_W = 110
const RULER_H = 22
const RESIZE_ZONE = 7
const MIN_ZOOM = 12
const MAX_ZOOM = 400

type Drag =
  | { kind: 'move'; hitId: string; downBeat: number; downRow: number; originals: Note[]; lastRow: number; changed: boolean }
  | { kind: 'resize'; originals: Note[]; anchor: Note; changed: boolean }
  | { kind: 'erase' }
  | { kind: 'marquee'; x0: number; y0: number; x1: number; y1: number; additive: string[] }

/**
 * Editor de notas da faixa selecionada (canvas com rolagem virtual).
 * Instrumentos com `rows` (bateria) usam o modo de peças: uma linha por peça.
 */
export function PianoRoll() {
  const trackId = useProjectStore((s) => s.selectedTrackId)
  const lengthBeats = useProjectStore((s) => projectLengthBeats(s.project))
  const instrumentId = useProjectStore((s) => s.project.tracks.find((t) => t.id === s.selectedTrackId)?.instrumentId)
  const layout = useMemo(() => createLayout(instrumentId ? getInstrument(instrumentId) : undefined), [instrumentId])
  const hiddenNotes = useProjectStore((s) => {
    const track = s.project.tracks.find((t) => t.id === s.selectedTrackId)
    return track ? track.notes.filter((n) => layout.indexOf(n.pitch) < 0).length : 0
  })
  const layoutRef = useRef<RollLayout>(layout)
  layoutRef.current = layout

  const [zoom, setZoom] = useState(80) // pixels por batida
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom

  const scrollerRef = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  const lastDuration = useRef(1)
  const hoverRow = useRef<number | null>(null)

  const currentTrack = (): Track | undefined => {
    const s = useProjectStore.getState()
    return s.project.tracks.find((t) => t.id === s.selectedTrackId)
  }

  const { canvasRef, invalidate } = useCanvasLoop((ctx, w, h) => {
    const s = useProjectStore.getState()
    const L = layoutRef.current
    const track = currentTrack()
    const scroller = scrollerRef.current
    const sx = scroller?.scrollLeft ?? 0
    const sy = scroller?.scrollTop ?? 0
    const pxPerBeat = zoomRef.current
    const total = projectLengthBeats(s.project)
    const rowH = L.rowH
    const gridX = (beat: number) => KEY_W + beat * pxPerBeat - sx
    const rowY = (row: number) => RULER_H + row * rowH - sy

    ctx.fillStyle = '#14141b'
    ctx.fillRect(0, 0, w, h)

    const firstRow = Math.max(0, Math.floor(sy / rowH))
    const lastRow = Math.min(L.rows.length - 1, Math.ceil((sy + h) / rowH))

    // Fundo das linhas
    for (let row = firstRow; row <= lastRow; row++) {
      const pitch = L.rows[row]
      const y = rowY(row)
      if (L.drum) {
        ctx.fillStyle = row % 2 ? '#191921' : '#1d1d27'
      } else {
        const outside = L.range && (pitch < L.range[0] || pitch > L.range[1])
        ctx.fillStyle = outside ? '#0a0a0d' : isBlackKey(pitch) ? '#16161d' : '#1b1b24'
      }
      ctx.fillRect(KEY_W, y, w, rowH)
      // Bordas da extensão natural
      if (L.range && (pitch === L.range[1] || pitch === L.range[0])) {
        ctx.fillStyle = 'rgba(255,184,77,0.45)'
        ctx.fillRect(KEY_W, pitch === L.range[1] ? y : y + rowH - 1, w, 1)
      }
      if (L.drum || pitch % 12 === 0) {
        ctx.fillStyle = '#2f2f3d'
        ctx.fillRect(KEY_W, y + rowH - 1, w, 1)
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
    if (s.snap * pxPerBeat >= 6) {
      ctx.fillStyle = '#20202a'
      for (let b = Math.floor(firstBeat / s.snap) * s.snap; b <= lastBeat; b += s.snap) {
        ctx.fillRect(Math.round(gridX(b)), RULER_H, 1, h)
      }
    }
    for (let b = Math.floor(firstBeat); b <= lastBeat; b++) {
      ctx.fillStyle = b % s.project.beatsPerBar === 0 ? '#3a3a4c' : '#2a2a37'
      ctx.fillRect(Math.round(gridX(b)), RULER_H, 1, h)
    }

    // Notas das outras faixas (fantasmas) — só no modo melódico, onde as alturas se comparam
    if (!L.drum) {
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
      for (const other of s.project.tracks) {
        if (other.id === track?.id || getInstrument(other.instrumentId).rows) continue
        for (const n of other.notes) {
          const row = L.indexOf(n.pitch)
          const x = gridX(n.start)
          if (row < 0 || x > w || x + n.duration * pxPerBeat < KEY_W) continue
          ctx.fillRect(x, rowY(row) + 1, n.duration * pxPerBeat, rowH - 2)
        }
      }
    }

    // Notas da faixa
    if (track) {
      const selected = new Set(s.selectedNoteIds)
      for (const n of track.notes) {
        const row = L.indexOf(n.pitch)
        if (row < 0) continue
        const x = gridX(n.start)
        const nw = Math.max(3, n.duration * pxPerBeat - 1)
        if (x > w || x + nw < KEY_W) continue
        const y = rowY(row)
        if (y > h || y + rowH < RULER_H) continue
        const inset = L.drum ? 4 : 1
        ctx.globalAlpha = 0.45 + n.velocity * 0.55
        ctx.fillStyle = track.color
        ctx.fillRect(x, y + inset, nw, rowH - inset * 2)
        ctx.globalAlpha = 1
        ctx.strokeStyle = selected.has(n.id) ? '#ffffff' : 'rgba(0,0,0,0.45)'
        ctx.lineWidth = selected.has(n.id) ? 1.5 : 1
        ctx.strokeRect(x + 0.5, y + inset + 0.5, nw - 1, rowH - inset * 2 - 1)
        if (nw > 34 && !L.drum) {
          ctx.fillStyle = 'rgba(0,0,0,0.6)'
          ctx.font = '10px Segoe UI, sans-serif'
          ctx.fillText(pitchName(n.pitch), x + 3, y + rowH - 3)
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

    // Teclado / nomes das peças
    for (let row = firstRow; row <= lastRow; row++) {
      const pitch = L.rows[row]
      const y = rowY(row)
      const hovered = hoverRow.current === row
      if (L.drum) {
        ctx.fillStyle = hovered ? '#3a3360' : row % 2 ? '#22222d' : '#262632'
        ctx.fillRect(0, y, KEY_W, rowH)
        ctx.fillStyle = '#14141b'
        ctx.fillRect(0, y + rowH - 1, KEY_W, 1)
        ctx.fillStyle = '#e6e6ef'
        ctx.font = '12px Segoe UI, sans-serif'
        ctx.fillText(L.labels?.[pitch] ?? pitchName(pitch), 10, y + rowH / 2 + 4)
      } else {
        const black = isBlackKey(pitch)
        ctx.fillStyle = hovered ? '#a395ff' : black ? '#2a2a33' : '#d9d9e3'
        ctx.fillRect(0, y, KEY_W, rowH)
        ctx.fillStyle = '#14141b'
        ctx.fillRect(0, y + rowH - 1, KEY_W, 1)
        const label = L.labels?.[pitch] ?? (pitch % 12 === 0 ? pitchName(pitch) : '')
        if (label) {
          ctx.fillStyle = black ? '#e6e6ef' : '#2a2a33'
          ctx.font = '10px Segoe UI, sans-serif'
          ctx.fillText(label, 4, y + rowH - 3)
        }
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
    if (layout.drum) {
      scroller.scrollTop = 0
    } else {
      const pitches = track.notes.map((n) => n.pitch)
      const center = pitches.length
        ? (Math.min(...pitches) + Math.max(...pitches)) / 2
        : getInstrument(track.instrumentId).focusPitch
      const row = layout.indexOf(Math.round(center))
      scroller.scrollTop = row * layout.rowH - (scroller.clientHeight - RULER_H) / 2
    }
    invalidate()
  }, [trackId, layout])

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
    const L = layoutRef.current
    const rect = scroller.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const cx = x - KEY_W + scroller.scrollLeft // coordenadas de conteúdo
    const cy = y - RULER_H + scroller.scrollTop
    const beat = cx / zoomRef.current
    const row = rowAtY(L, cy)
    return { x, y, cx, cy, beat, row, pitch: L.rows[row] }
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
        drag.current = {
          kind: 'move', hitId: hit.note.id, downBeat: p.beat, downRow: p.row, originals, lastRow: p.row, changed: false,
        }
        preview(hit.note.pitch)
      }
      return
    }

    if (e.shiftKey || e.ctrlKey) {
      drag.current = { kind: 'marquee', x0: p.cx, y0: p.cy, x1: p.cx, y1: p.cy, additive: s.selectedNoteIds }
      return
    }

    // Clique em área vazia: cria uma nota e permite esticá-la arrastando.
    // Na bateria as peças são golpes curtos: a nota nasce com o tamanho da grade.
    const start = snapFloor(p.beat)
    const duration = layoutRef.current.drum ? s.snap : Math.max(s.snap, lastDuration.current)
    const note = s.addNote(track.id, p.pitch, start, duration)
    s.selectNotes([note.id])
    drag.current = { kind: 'resize', originals: [note], anchor: note, changed: true }
    preview(p.pitch)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = useProjectStore.getState()
    const L = layoutRef.current
    const track = currentTrack()
    const p = locate(e)
    const d = drag.current
    const scroller = scrollerRef.current!

    const hr = p.x < KEY_W && p.y > RULER_H ? p.row : null
    if (hr !== hoverRow.current) {
      hoverRow.current = hr
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
      const dBeat = Math.max(snapRound(p.beat - d.downBeat), -minStart)
      const dRow = clampRowDelta(L, d.originals.map((n) => n.pitch), p.row - d.downRow)
      if (!d.changed && dBeat === 0 && dRow === 0) return
      if (!d.changed) {
        s.checkpoint()
        d.changed = true
      }
      const changes: Record<string, Partial<Note>> = {}
      for (const n of d.originals) changes[n.id] = { start: n.start + dBeat, pitch: shiftPitch(L, n.pitch, dRow) }
      s.updateNotes(track.id, changes, false)
      if (p.row !== d.lastRow && dRow !== 0) {
        d.lastRow = p.row
        const hitNote = d.originals.find((n) => n.id === d.hitId)!
        preview(shiftPitch(L, hitNote.pitch, dRow))
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
      if (!L.drum) lastDuration.current = newDuration
    } else if (d.kind === 'marquee') {
      d.x1 = p.cx
      d.y1 = p.cy
      const b0 = Math.min(d.x0, d.x1) / zoomRef.current
      const b1 = Math.max(d.x0, d.x1) / zoomRef.current
      const r0 = rowAtY(L, Math.min(d.y0, d.y1))
      const r1 = rowAtY(L, Math.max(d.y0, d.y1))
      const inside = track.notes
        .filter((n) => {
          const r = L.indexOf(n.pitch)
          return r >= r0 && r <= r1 && n.start < b1 && n.start + n.duration > b0
        })
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
    if (d?.kind === 'move' && !layoutRef.current.drum) {
      const hit = currentTrack()?.notes.find((n) => n.id === d.hitId)
      if (hit) lastDuration.current = hit.duration
    }
    drag.current = null
    invalidate()
  }

  const contentW = KEY_W + lengthBeats * zoom + 200
  const contentH = RULER_H + layout.rows.length * layout.rowH

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
          if (hoverRow.current !== null) {
            hoverRow.current = null
            invalidate()
          }
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div style={{ width: contentW, height: contentH }} />
      </div>
      {!trackId && <div className="empty">Adicione uma faixa para começar a compor.</div>}
      <div className="hint">
        {hiddenNotes > 0 && (
          <span className="warn">
            {hiddenNotes} nota(s) fora do kit ficam ocultas e não tocam ·{' '}
          </span>
        )}
        {layout.range && !layout.drum && 'Área escura: fora da extensão natural do instrumento · '}
        Clique: criar · Arrastar: mover/esticar · Botão direito: apagar · Shift+arrastar: selecionar · Ctrl+roda: zoom
      </div>
    </div>
  )
}
