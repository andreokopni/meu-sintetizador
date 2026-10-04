import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import { buildProjectMidi, buildProjectMusicXml } from '../notation/scoreExport'
import { saveAnyFile, savePagePdf } from '../platform'
import { useProjectStore } from '../store/useProjectStore'

/** Largura usada ao gerar o PDF (cabe numa folha A4 com margens). */
const PRINT_WIDTH = 720

/**
 * Janela de partitura: escolhe as faixas, mostra a partitura (OpenSheetMusicDisplay,
 * carregado só quando a janela abre) e exporta MusicXML, MIDI e PDF.
 * Fica num portal fora de .app para o CSS de impressão poder esconder o resto do app.
 */
export function ScoreModal({ onClose }: { onClose(): void }) {
  const project = useProjectStore((s) => s.project)
  const withNotes = project.tracks.filter((t) => t.notes.length > 0)
  const [selected, setSelected] = useState<string[]>(() => withNotes.filter((t) => !t.mute).map((t) => t.id))
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const sheetRef = useRef<HTMLDivElement>(null)
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null)

  const tracks = useMemo(() => withNotes.filter((t) => selected.includes(t.id)), [withNotes, selected])
  const xml = useMemo(() => (tracks.length ? buildProjectMusicXml(project, tracks) : ''), [project, tracks])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // (Re)desenha a partitura quando o conteúdo muda.
  useEffect(() => {
    let cancelled = false
    const render = async () => {
      if (!xml || !sheetRef.current) return
      setStatus('loading')
      try {
        if (!osmdRef.current) {
          const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay')
          osmdRef.current = new OpenSheetMusicDisplay(sheetRef.current, {
            autoResize: true,
            backend: 'svg',
            drawTitle: true,
            drawPartNames: true,
            drawComposer: false,
          })
        }
        await osmdRef.current.load(xml)
        if (cancelled) return
        osmdRef.current.render()
        setStatus('ready')
      } catch (err) {
        console.error('Erro ao desenhar a partitura', err)
        if (!cancelled) setStatus('error')
      }
    }
    render()
    return () => {
      cancelled = true
    }
  }, [xml])

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : withNotes.filter((t) => [...s, id].includes(t.id)).map((t) => t.id)))

  const exportPdf = async () => {
    const sheet = sheetRef.current
    const osmd = osmdRef.current
    if (!sheet || !osmd) return
    // Redesenha na largura da folha, imprime e volta ao tamanho da tela.
    sheet.classList.add('printing')
    sheet.style.width = `${PRINT_WIDTH}px`
    osmd.render()
    try {
      await savePagePdf(`${project.name}.pdf`)
    } finally {
      sheet.classList.remove('printing')
      sheet.style.width = ''
      osmd.render()
    }
  }

  return createPortal(
    <div className="score-overlay" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="score-window">
        <header>
          <span className="builder-title">🎼 Partitura</span>
          <div className="score-tracks">
            {withNotes.map((t) => (
              <label key={t.id} style={{ borderColor: t.color }}>
                <input type="checkbox" checked={selected.includes(t.id)} onChange={() => toggle(t.id)} />
                {t.name}
              </label>
            ))}
          </div>
          <div className="spacer" />
          <button onClick={exportPdf} disabled={status !== 'ready'} title="Salvar a partitura em PDF (para imprimir)">
            PDF
          </button>
          <button
            onClick={() => saveAnyFile(xml, `${project.name}.musicxml`, 'application/vnd.recordare.musicxml+xml', 'MusicXML', ['musicxml'])}
            disabled={!xml}
            title="Abre e edita no MuseScore (gratuito), Finale, Sibelius, Dorico..."
          >
            MusicXML
          </button>
          <button
            onClick={() => {
              const midi = buildProjectMidi(project, tracks)
              saveAnyFile(midi.buffer as ArrayBuffer, `${project.name}.mid`, 'audio/midi', 'MIDI', ['mid'])
            }}
            disabled={!tracks.length}
            title="Arquivo MIDI para outros programas de música"
          >
            MIDI
          </button>
          <button onClick={onClose} title="Fechar (Esc)">✕</button>
        </header>
        <div className="score-body">
          {!tracks.length && <div className="score-empty">Escolha ao menos uma faixa com notas.</div>}
          {status === 'loading' && tracks.length > 0 && <div className="score-empty">Desenhando a partitura…</div>}
          {status === 'error' && <div className="score-empty">Não foi possível desenhar a partitura.</div>}
          <div className="score-sheet" ref={sheetRef} />
          <p className="score-note">
            Notas arredondadas para semicolcheias. Para editar a partitura em detalhe, exporte em MusicXML e abra no MuseScore.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
