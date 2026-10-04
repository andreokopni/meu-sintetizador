import * as Tone from 'tone'
import { projectLengthBeats, type Note, type ParamValues, type Project } from '../model/project'
import { effectiveParams, getInstrument } from './instruments/registry'
import type { InstrumentVoice } from './instruments/types'
import { isTrackAudible, volumeToDb } from './mixLogic'
import { scheduleNotes } from './scheduling'

interface TrackNodes {
  channel: Tone.Channel
  voice: InstrumentVoice
  instrumentId: string
  params: ParamValues
  notes: Note[]
  part: Tone.Part
}

/**
 * Motor de áudio ao vivo. Recebe o projeto inteiro em sync() e aplica só o que
 * mudou (comparando referências — o store é imutável).
 */
class AudioEngine {
  private master = new Tone.Limiter(-1).toDestination()
  private nodes = new Map<string, TrackNodes>()
  private bpm = 120
  private transport = Tone.getTransport()

  sync(project: Project) {
    this.bpm = project.bpm
    this.transport.bpm.value = project.bpm
    this.transport.loopStart = 0
    this.transport.loopEnd = `${Math.round(projectLengthBeats(project) * this.transport.PPQ)}i`

    const ids = new Set(project.tracks.map((t) => t.id))
    for (const [id, nodes] of this.nodes) {
      if (!ids.has(id)) {
        this.disposeNodes(nodes)
        this.nodes.delete(id)
      }
    }

    for (const track of project.tracks) {
      let nodes = this.nodes.get(track.id)
      if (!nodes) {
        const channel = new Tone.Channel().connect(this.master)
        const voice = getInstrument(track.instrumentId).create(channel, effectiveParams(track))
        nodes = {
          channel,
          voice,
          instrumentId: track.instrumentId,
          params: track.params,
          notes: track.notes,
          part: scheduleNotes(this.transport, voice, track.notes, () => this.bpm),
        }
        this.nodes.set(track.id, nodes)
      } else if (nodes.instrumentId !== track.instrumentId) {
        nodes.part.dispose()
        nodes.voice.dispose()
        nodes.voice = getInstrument(track.instrumentId).create(nodes.channel, effectiveParams(track))
        nodes.instrumentId = track.instrumentId
        nodes.params = track.params
        nodes.notes = track.notes
        nodes.part = scheduleNotes(this.transport, nodes.voice, track.notes, () => this.bpm)
      } else {
        if (nodes.params !== track.params) {
          nodes.voice.setParams(effectiveParams(track))
          nodes.params = track.params
        }
        if (nodes.notes !== track.notes) {
          nodes.part.dispose()
          nodes.part = scheduleNotes(this.transport, nodes.voice, track.notes, () => this.bpm)
          nodes.notes = track.notes
        }
      }

      nodes.channel.volume.value = volumeToDb(track.volume)
      nodes.channel.pan.value = track.pan
      nodes.channel.mute = !isTrackAudible(track, project.tracks)
    }
  }

  /** Precisa ser chamado a partir de um gesto do usuário (clique/tecla). */
  async unlock() {
    if (Tone.getContext().state !== 'running') await Tone.start()
  }

  async play(fromBeat: number, loop: boolean) {
    await this.unlock()
    this.transport.loop = loop
    this.transport.ticks = Math.round(fromBeat * this.transport.PPQ)
    this.transport.start()
  }

  stop() {
    this.transport.pause()
    for (const nodes of this.nodes.values()) nodes.voice.releaseAll()
  }

  setLoop(loop: boolean) {
    this.transport.loop = loop
  }

  seek(beat: number) {
    this.transport.ticks = Math.round(beat * this.transport.PPQ)
  }

  get isPlaying() {
    return this.transport.state === 'started'
  }

  getPositionBeats(): number {
    return this.transport.ticks / this.transport.PPQ
  }

  async previewNote(trackId: string, pitch: number, durationSec = 0.35) {
    await this.unlock()
    this.nodes.get(trackId)?.voice.trigger(pitch, Tone.immediate(), durationSec, 0.8)
  }

  /** Resolve quando todos os instrumentos (samples) estiverem carregados. */
  async whenReady() {
    await Promise.all([...this.nodes.values()].map((n) => n.voice.ready))
  }

  private disposeNodes(nodes: TrackNodes) {
    nodes.part.dispose()
    nodes.voice.dispose()
    nodes.channel.dispose()
  }
}

export const engine = new AudioEngine()
