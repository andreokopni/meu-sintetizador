import { useEffect, useRef, useState } from 'react'
import { exportWav, importScore, newProject, openExample, openProject, saveProject } from '../actions/fileActions'
import { EXAMPLES } from '../model/examples'
import { setLoop, setPlayStart, togglePlayback } from '../actions/transport'
import { engine } from '../audio/engine'
import { useProjectStore } from '../store/useProjectStore'

const SNAP_OPTIONS = [
  { value: 1, label: '1/4' },
  { value: 0.5, label: '1/8' },
  { value: 0.25, label: '1/16' },
  { value: 1 / 3, label: '1/4 T' },
  { value: 1 / 6, label: '1/8 T' },
  { value: 0.125, label: '1/32' },
]

/** Mostra compasso.tempo.semicolcheia, atualizado a cada quadro. */
function PositionDisplay() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let frame = 0
    const update = () => {
      const { isPlaying, playStart, project } = useProjectStore.getState()
      const beat = isPlaying ? engine.getPositionBeats() : playStart
      const bar = Math.floor(beat / project.beatsPerBar) + 1
      const beatInBar = Math.floor(beat % project.beatsPerBar) + 1
      const sixteenth = Math.floor((beat % 1) * 4) + 1
      if (ref.current) ref.current.textContent = `${bar}.${beatInBar}.${sixteenth}`
      frame = requestAnimationFrame(update)
    }
    update()
    return () => cancelAnimationFrame(frame)
  }, [])
  return <div className="position" ref={ref} title="Compasso.Tempo.Semicolcheia" />
}

/** Botão "Abrir ▾": projeto do computador, importar partitura e músicas de exemplo. */
function OpenMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', close)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', close)
    }
  }, [open])

  const run = (action: () => void) => () => {
    setOpen(false)
    action()
  }

  return (
    <div className="menu" ref={ref}>
      <button className={open ? 'active' : ''} onClick={() => setOpen(!open)} title="Abrir projeto, importar partitura ou exemplos">
        Abrir ▾
      </button>
      {open && (
        <div className="menu-popup">
          <button onClick={run(openProject)}>
            Projeto do computador… <kbd>Ctrl+O</kbd>
          </button>
          <button onClick={run(importScore)}>
            Importar partitura… <small>MIDI, MusicXML</small>
          </button>
          <div className="menu-label">Exemplos (domínio público)</div>
          {EXAMPLES.map((ex) => (
            <button key={ex.id} onClick={run(() => openExample(ex.id))}>
              {ex.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function Toolbar({ onOpenScore }: { onOpenScore?: () => void }) {
  const project = useProjectStore((s) => s.project)
  const isPlaying = useProjectStore((s) => s.isPlaying)
  const loop = useProjectStore((s) => s.loop)
  const snap = useProjectStore((s) => s.snap)
  const canUndo = useProjectStore((s) => s.past.length > 0)
  const canRedo = useProjectStore((s) => s.future.length > 0)
  const { apply, undo, redo, setSnap } = useProjectStore.getState()

  return (
    <div className="toolbar">
      <span className="brand">♪ Meu Sintetizador</span>
      <div className="sep" />
      <div className="group">
        <button onClick={newProject} title="Novo projeto">Novo</button>
        <OpenMenu />
        <button onClick={() => saveProject()} title="Salvar (Ctrl+S) — Ctrl+Shift+S salva como">Salvar</button>
        <button onClick={exportWav} title="Renderizar a música em um arquivo .wav">Exportar WAV</button>
        <button onClick={onOpenScore} title="Ver a partitura e exportar PDF, MusicXML ou MIDI">🎼 Partitura</button>
      </div>
      <div className="sep" />
      <div className="group">
        <button onClick={undo} disabled={!canUndo} title="Desfazer (Ctrl+Z)">↶</button>
        <button onClick={redo} disabled={!canRedo} title="Refazer (Ctrl+Y)">↷</button>
      </div>
      <div className="sep" />
      <div className="group">
        <button onClick={() => setPlayStart(0)} title="Voltar ao início">⏮</button>
        <button className={`play ${isPlaying ? 'active' : ''}`} onClick={togglePlayback} title="Tocar / Parar (Espaço)">
          {isPlaying ? '■ Parar' : '▶ Tocar'}
        </button>
        <button className={loop ? 'active' : ''} onClick={() => setLoop(!loop)} title="Repetir a música">
          ⟳ Loop
        </button>
        <PositionDisplay />
      </div>
      <div className="sep" />
      <label>
        BPM
        <input
          type="number"
          min={20}
          max={300}
          value={project.bpm}
          onChange={(e) => {
            const bpm = Number(e.target.value)
            if (bpm >= 20 && bpm <= 300) apply((p) => ({ ...p, bpm }))
          }}
        />
      </label>
      <label>
        Compassos
        <input
          type="number"
          min={1}
          max={512}
          value={project.lengthBars}
          onChange={(e) => {
            const lengthBars = Math.round(Number(e.target.value))
            if (lengthBars >= 1 && lengthBars <= 512) apply((p) => ({ ...p, lengthBars }))
          }}
        />
      </label>
      <label>
        Grade
        <select value={snap} onChange={(e) => setSnap(Number(e.target.value))}>
          {SNAP_OPTIONS.map((o) => (
            <option key={o.label} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <div className="spacer" />
      <input
        className="project-name"
        type="text"
        value={project.name}
        title="Nome da música"
        onChange={(e) => apply((p) => ({ ...p, name: e.target.value }), false)}
      />
    </div>
  )
}
