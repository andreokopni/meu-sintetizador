// Contratos para futuras integrações com IA. Ainda sem implementação.
//
// Ideia de arquitetura: um serviço (API na nuvem ou backend Python local
// iniciado pelo Electron como "sidecar") implementa estas interfaces. Como o
// projeto é JSON puro (src/model/project.ts), um modelo de linguagem pode gerar
// ou editar músicas devolvendo um Project / lista de Tracks.

import type { Note, Project, Track } from '../model/project'

export interface SongRequest {
  prompt: string
  bpm?: number
  lengthBars?: number
  /** Instrumentos disponíveis (ids do registro) que a IA pode usar. */
  availableInstruments: { id: string; name: string; category: string }[]
}

/** Gera uma música completa (ou faixas para adicionar) a partir de um texto. */
export interface SongGenerator {
  generateSong(request: SongRequest, signal?: AbortSignal): Promise<Project>
  /** Sugere novas faixas que combinem com o projeto atual. */
  suggestTracks?(project: Project, prompt: string, signal?: AbortSignal): Promise<Track[]>
}

export interface VoiceRequest {
  lyrics: string
  /** Melodia que a voz deve cantar. */
  notes: Note[]
  bpm: number
  voiceId: string
}

/** Síntese de voz cantada: devolve áudio (WAV/MP3) para virar uma faixa de áudio. */
export interface VoiceSynthesizer {
  listVoices(): Promise<{ id: string; name: string }[]>
  synthesize(request: VoiceRequest, signal?: AbortSignal): Promise<ArrayBuffer>
}
