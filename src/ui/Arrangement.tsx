import { useState } from 'react'
import { setPlayStart } from '../actions/transport'
import { projectLengthBeats, type Track } from '../model/project'
import { useProjectStore } from '../store/useProjectStore'
import { InstrumentSelect } from './InstrumentSelect'
import { playheadBeat, useCanvasLoop } from './useCanvas'

const RULER_H = 22
const LANE_H = 56

function TrackHeader({ track, selected }: { track: Track; selected: boolean }) {
  const { selectTrack, updateTrack, setInstrument, removeTrack, checkpoint } = useProjectStore.getState()
  return (
    <div className={`track-header ${selected ? 'selected' : ''}`} onMouseDown={() => selectTrack(track.id)}>
      <div className="color" style={{ background: track.color }} />
      <input
        className="name"
        type="text"
        value={track.name}
        onFocus={checkpoint}
        onChange={(e) => updateTrack(track.id, { name: e.target.value }, false)}
      />
      <div className="buttons">
        <button
          className={`mute ${track.mute ? 'active' : ''}`}
          title="Mudo"
          onClick={() => updateTrack(track.id, { mute: !track.mute })}
        >
          M
        </button>
        <button
          className={`solo ${track.solo ? 'active' : ''}`}
          title="Solo"
          onClick={() => updateTrack(track.id, { solo: !track.solo })}
        >
          S
        </button>
        <button
          className="delete"
          title="Remover faixa"
          onClick={(e) => {
            e.stopPropagation()
            if (!track.notes.length || window.confirm(`Remover a faixa "${track.name}"?`)) removeTrack(track.id)
          }}
        >
          ✕
        </button>
      </div>
      <InstrumentSelect value={track.instrumentId} onChange={(id) => setInstrument(track.id, id)} />
      <label className="volume" title="Volume">
        Vol
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={track.volume}
          onPointerDown={checkpoint}
          onChange={(e) => updateTrack(track.id, { volume: Number(e.target.value) }, false)}
        />
      </label>
    </div>
  )
}

function AddTrack() {
  const [instrumentId, setInstrumentId] = useState('sample:piano')
  return (
    <div className="add-track">
      <InstrumentSelect value={instrumentId} onChange={setInstrumentId} />
      <button onClick={() => useProjectStore.getState().addTrack(instrumentId)}>+ Faixa</button>
    </div>
  )
}

/** Visão geral: cabeçalhos das faixas à esquerda e miniaturas das notas na linha do tempo. */
export function Arrangement() {
  const tracks = useProjectStore((s) => s.project.tracks)
  const selectedTrackId = useProjectStore((s) => s.selectedTrackId)
  const height = RULER_H + tracks.length * LANE_H

  const { canvasRef } = useCanvasLoop((ctx, w, h) => {
    const { project, selectedTrackId } = useProjectStore.getState()
    const totalBeats = projectLengthBeats(project)
    const pxPerBeat = w / totalBeats
    ctx.fillStyle = '#14141b'
    ctx.fillRect(0, 0, w, h)

    project.tracks.forEach((track, i) => {
      const y = RULER_H + i * LANE_H
      ctx.fillStyle = track.id === selectedTrackId ? '#23232f' : i % 2 ? '#181820' : '#1a1a23'
      ctx.fillRect(0, y, w, LANE_H)
    })

    // Linhas de compasso
    for (let bar = 0; bar <= project.lengthBars; bar++) {
      const x = Math.round(bar * project.beatsPerBar * pxPerBeat) + 0.5
      ctx.strokeStyle = '#2f2f3d'
      ctx.beginPath()
      ctx.moveTo(x, RULER_H)
      ctx.lineTo(x, h)
      ctx.stroke()
    }

    // Miniaturas das notas
    project.tracks.forEach((track, i) => {
      if (!track.notes.length) return
      const y0 = RULER_H + i * LANE_H + 6
      const laneH = LANE_H - 12
      let min = 127
      let max = 0
      for (const n of track.notes) {
        min = Math.min(min, n.pitch)
        max = Math.max(max, n.pitch)
      }
      const range = Math.max(12, max - min + 1)
      const noteH = Math.max(2, laneH / range)
      ctx.fillStyle = track.color
      ctx.globalAlpha = track.mute ? 0.3 : 0.9
      for (const n of track.notes) {
        const x = n.start * pxPerBeat
        const y = y0 + ((max - n.pitch) / range) * laneH
        ctx.fillRect(x, y, Math.max(1.5, n.duration * pxPerBeat - 1), noteH)
      }
      ctx.globalAlpha = 1
    })

    // Linhas entre faixas
    ctx.strokeStyle = '#2f2f3d'
    project.tracks.forEach((_, i) => {
      const y = RULER_H + (i + 1) * LANE_H - 0.5
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    })

    // Régua
    ctx.fillStyle = '#1c1c26'
    ctx.fillRect(0, 0, w, RULER_H)
    ctx.fillStyle = '#9393a8'
    ctx.font = '11px Segoe UI, sans-serif'
    const labelEvery = Math.max(1, Math.ceil(28 / (project.beatsPerBar * pxPerBeat)))
    for (let bar = 0; bar < project.lengthBars; bar += labelEvery) {
      ctx.fillText(String(bar + 1), bar * project.beatsPerBar * pxPerBeat + 4, 15)
    }
    ctx.fillStyle = '#2f2f3d'
    ctx.fillRect(0, RULER_H - 1, w, 1)

    // Cursor de reprodução
    const x = Math.round(playheadBeat() * pxPerBeat) + 0.5
    ctx.strokeStyle = '#ffffff'
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
    ctx.stroke()
  })

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { project, selectTrack } = useProjectStore.getState()
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const beat = (x / rect.width) * projectLengthBeats(project)
    setPlayStart(Math.floor(beat))
    if (y > RULER_H) {
      const track = project.tracks[Math.floor((y - RULER_H) / LANE_H)]
      if (track) selectTrack(track.id)
    }
  }

  return (
    <div className="arrangement">
      <div className="arrangement-scroll">
        <div className="track-headers">
          <div className="ruler-spacer">FAIXAS</div>
          {tracks.map((t) => (
            <TrackHeader key={t.id} track={t} selected={t.id === selectedTrackId} />
          ))}
          <AddTrack />
        </div>
        <div className="lanes">
          <canvas ref={canvasRef} style={{ width: '100%', height }} onMouseDown={onMouseDown} />
        </div>
      </div>
    </div>
  )
}
