import * as Tone from 'tone'
import type { Note } from '../model/project'
import type { InstrumentVoice } from './instruments/types'

type Transport = ReturnType<typeof Tone.getTransport>

/**
 * Cria um Tone.Part que dispara as notas no transporte do contexto atual
 * (o ao vivo ou o offline, na exportação). `getBpm` é lido a cada nota para
 * que mudanças de andamento durante a reprodução valham na hora.
 */
export function scheduleNotes(
  transport: Transport,
  voice: InstrumentVoice,
  notes: Note[],
  getBpm: () => number,
): Tone.Part {
  const ppq = transport.PPQ
  const events = notes.map((note) => ({ time: `${Math.round(note.start * ppq)}i`, note }))
  const part = new Tone.Part<{ time: string; note: Note }>((time, event) => {
    const seconds = (event.note.duration * 60) / getBpm()
    voice.trigger(event.note.pitch, time, seconds, event.note.velocity)
  }, events)
  part.start(0)
  return part
}
