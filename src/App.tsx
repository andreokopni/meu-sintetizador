import { useEffect, useRef, useState } from 'react'
import { confirmDiscard, openProject, saveProject } from './actions/fileActions'
import { togglePlayback } from './actions/transport'
import { engine } from './audio/engine'
import { getInstrument } from './audio/instruments/registry'
import { isUserTimbre } from './audio/instruments/userTimbres'
import { useProjectStore } from './store/useProjectStore'
import { Arrangement } from './ui/Arrangement'
import { BuilderModal } from './ui/BuilderModal'
import { ScoreModal } from './ui/ScoreModal'
import { InstrumentEditor } from './ui/InstrumentEditor'
import { loadNumber, saveNumber } from './ui/persist'
import { PianoRoll } from './ui/PianoRoll'
import { Toolbar } from './ui/Toolbar'

const MIN_ARRANGEMENT_H = 90
const MIN_EDITOR_H = 180

/** Altura da área de faixas, ajustável arrastando a divisória acima do piano roll. */
function useSplitter() {
  const [height, setHeight] = useState(() => loadNumber('layout.arrangementH', 300))
  const arrangementRef = useRef<HTMLDivElement>(null)

  useEffect(() => saveNumber('layout.arrangementH', height), [height])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const top = arrangementRef.current?.getBoundingClientRect().top ?? 0
    const move = (ev: PointerEvent) => {
      const max = window.innerHeight - top - MIN_EDITOR_H
      setHeight(Math.round(Math.min(max, Math.max(MIN_ARRANGEMENT_H, ev.clientY - top))))
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return { height, arrangementRef, onPointerDown }
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
}

export default function App() {
  const busy = useProjectStore((s) => s.busy)
  const name = useProjectStore((s) => s.project.name)
  const dirty = useProjectStore((s) => s.dirty)
  const splitter = useSplitter()
  const [builderOpen, setBuilderOpen] = useState(false)
  const [scoreOpen, setScoreOpen] = useState(false)
  // O construtor só abre para timbres do usuário baseados nele (a fábrica é fixa).
  const builderTrack = useProjectStore((s) => {
    const track = s.project.tracks.find((t) => t.id === s.selectedTrackId)
    return track && isUserTimbre(track.instrumentId) && getInstrument(track.instrumentId).editor === 'builder'
      ? track
      : undefined
  })

  // Mantém o motor de áudio sincronizado com o projeto.
  useEffect(() => {
    engine.sync(useProjectStore.getState().project)
    return useProjectStore.subscribe((state, prev) => {
      if (state.project !== prev.project) engine.sync(state.project)
    })
  }, [])

  useEffect(() => {
    document.title = `${dirty ? '• ' : ''}${name} — Meu Sintetizador`
  }, [name, dirty])

  // Pergunta sobre alterações não salvas ao fechar a janela.
  useEffect(() => {
    if (window.desktop) {
      window.desktop.onCloseRequested(() => {
        if (confirmDiscard()) window.desktop!.confirmClose()
      })
      return
    }
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (useProjectStore.getState().dirty) e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  // O áudio do navegador só pode começar após um gesto do usuário.
  useEffect(() => {
    const unlock = () => engine.unlock()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  // Atalhos de teclado globais.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const s = useProjectStore.getState()
      if (s.busy) return
      const ctrl = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      if (ctrl && key === 's') {
        e.preventDefault()
        saveProject(e.shiftKey)
      } else if (ctrl && key === 'o') {
        e.preventDefault()
        openProject()
      } else if (isTyping(e.target)) {
        return
      } else if (e.code === 'Space') {
        e.preventDefault()
        togglePlayback()
      } else if (ctrl && key === 'z') {
        e.preventDefault()
        if (e.shiftKey) s.redo()
        else s.undo()
      } else if (ctrl && key === 'y') {
        e.preventDefault()
        s.redo()
      } else if (ctrl && key === 'a' && s.selectedTrackId) {
        e.preventDefault()
        const track = s.project.tracks.find((t) => t.id === s.selectedTrackId)
        s.selectNotes(track?.notes.map((n) => n.id) ?? [])
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && s.selectedTrackId) {
        e.preventDefault()
        s.deleteNotes(s.selectedTrackId, s.selectedNoteIds)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="app" style={{ gridTemplateRows: `auto ${splitter.height}px 6px 1fr` }}>
      <Toolbar onOpenScore={() => setScoreOpen(true)} />
      <div ref={splitter.arrangementRef} className="arrangement-slot">
        <Arrangement />
      </div>
      <div className="splitter" onPointerDown={splitter.onPointerDown} title="Arraste para redimensionar" />
      <div className="editor">
        <PianoRoll />
        <InstrumentEditor onOpenBuilder={() => setBuilderOpen(true)} />
      </div>
      {builderOpen && builderTrack && <BuilderModal track={builderTrack} onClose={() => setBuilderOpen(false)} />}
      {scoreOpen && <ScoreModal onClose={() => setScoreOpen(false)} />}
      {busy && (
        <div className="overlay">
          <div className="overlay-box">{busy}</div>
        </div>
      )}
    </div>
  )
}
