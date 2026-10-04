import { useEffect } from 'react'
import { confirmDiscard, openProject, saveProject } from './actions/fileActions'
import { togglePlayback } from './actions/transport'
import { engine } from './audio/engine'
import { useProjectStore } from './store/useProjectStore'
import { Arrangement } from './ui/Arrangement'
import { InstrumentEditor } from './ui/InstrumentEditor'
import { PianoRoll } from './ui/PianoRoll'
import { Toolbar } from './ui/Toolbar'

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
}

export default function App() {
  const busy = useProjectStore((s) => s.busy)
  const name = useProjectStore((s) => s.project.name)
  const dirty = useProjectStore((s) => s.dirty)

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
    <div className="app">
      <Toolbar />
      <Arrangement />
      <div className="editor">
        <PianoRoll />
        <InstrumentEditor />
      </div>
      {busy && (
        <div className="overlay">
          <div className="overlay-box">{busy}</div>
        </div>
      )}
    </div>
  )
}
