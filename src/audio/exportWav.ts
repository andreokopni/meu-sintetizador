import * as Tone from 'tone'
import { lastNoteEnd, type Project } from '../model/project'
import { effectiveParams, getInstrument } from './instruments/registry'
import { isTrackAudible, volumeToDb } from './mixLogic'
import { scheduleNotes } from './scheduling'
import { encodeWav } from './wav'

/** Segundos extras no fim para as caudas (release) das notas. */
const TAIL_SECONDS = 2.5

/** Renderiza o projeto offline (mais rápido que tempo real) e devolve o WAV. */
export async function renderProjectToWav(project: Project, sampleRate = 44100): Promise<ArrayBuffer> {
  // Vai até o fim do compasso da última nota.
  const bars = Math.max(1, Math.ceil(lastNoteEnd(project) / project.beatsPerBar))
  const seconds = (bars * project.beatsPerBar * 60) / project.bpm + TAIL_SECONDS

  // Equivalente ao Tone.Offline, mas com render(false): o Tone.Offline pausa com
  // setTimeout a cada segundo de áudio, e navegadores atrasam esses timers em
  // abas/janelas em segundo plano (exportação ficava minutos mais lenta).
  const original = Tone.getContext()
  const context = new Tone.OfflineContext(2, seconds, sampleRate)
  Tone.setContext(context)
  let rendering: Promise<Tone.ToneAudioBuffer>
  try {
    const transport = context.transport
    transport.bpm.value = project.bpm
    const master = new Tone.Limiter(-1).toDestination()
    const voices = []
    for (const track of project.tracks) {
      if (!isTrackAudible(track, project.tracks) || track.notes.length === 0) continue
      const channel = new Tone.Channel({ volume: volumeToDb(track.volume), pan: track.pan }).connect(master)
      const voice = getInstrument(track.instrumentId).create(channel, effectiveParams(track))
      voices.push(voice)
      scheduleNotes(transport, voice, track.notes, () => project.bpm)
    }
    await Promise.all(voices.map((v) => v.ready))
    transport.start(0)
    rendering = context.render(false)
  } finally {
    Tone.setContext(original)
  }
  const rendered = await rendering
  context.dispose()
  return encodeWav(rendered.get()!)
}
