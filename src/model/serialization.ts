import { PROJECT_VERSION, uid, type Note, type Project, type Track } from './project'

const FORMAT = 'meu-sintetizador'

export function serializeProject(project: Project): string {
  return JSON.stringify({ format: FORMAT, ...project, version: PROJECT_VERSION }, null, 2)
}

function num(value: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.min(max, Math.max(min, n))
}

function parseNote(raw: any): Note | null {
  if (!raw || typeof raw !== 'object') return null
  const duration = num(raw.duration, 0)
  if (duration <= 0) return null
  return {
    id: typeof raw.id === 'string' ? raw.id : uid(),
    pitch: Math.round(num(raw.pitch, 60, 0, 127)),
    start: num(raw.start, 0, 0),
    duration,
    velocity: num(raw.velocity, 0.8, 0, 1),
  }
}

function parseTrack(raw: any, index: number): Track {
  if (!raw || typeof raw !== 'object') throw new Error(`Faixa ${index + 1} inválida`)
  const params: Track['params'] = {}
  if (raw.params && typeof raw.params === 'object') {
    for (const [k, v] of Object.entries(raw.params)) {
      if (typeof v === 'number' || typeof v === 'string') params[k] = v
    }
  }
  return {
    id: typeof raw.id === 'string' ? raw.id : uid(),
    name: typeof raw.name === 'string' ? raw.name : `Faixa ${index + 1}`,
    color: typeof raw.color === 'string' ? raw.color : '#7c6cff',
    instrumentId: typeof raw.instrumentId === 'string' ? raw.instrumentId : 'lead',
    params,
    volume: num(raw.volume, 0.8, 0, 1),
    pan: num(raw.pan, 0, -1, 1),
    mute: raw.mute === true,
    solo: raw.solo === true,
    notes: Array.isArray(raw.notes) ? raw.notes.map(parseNote).filter((n: Note | null): n is Note => !!n) : [],
  }
}

/** Migra versões antigas do formato para a atual. Adicione um passo por versão. */
function migrate(raw: any): any {
  const version = num(raw.version, 1)
  if (version > PROJECT_VERSION) {
    throw new Error('Este projeto foi criado por uma versão mais nova do Meu Sintetizador.')
  }
  // Ex.: if (version < 2) { raw = { ...raw, novoCampo: padrão }; }
  return raw
}

export function parseProject(text: string): Project {
  let raw: any
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('Arquivo inválido: não é um JSON.')
  }
  if (!raw || typeof raw !== 'object' || raw.format !== FORMAT) {
    throw new Error('Arquivo inválido: não é um projeto do Meu Sintetizador.')
  }
  raw = migrate(raw)
  if (!Array.isArray(raw.tracks)) throw new Error('Arquivo inválido: lista de faixas ausente.')
  return {
    version: PROJECT_VERSION,
    name: typeof raw.name === 'string' ? raw.name : 'Sem título',
    bpm: num(raw.bpm, 120, 20, 300),
    beatsPerBar: Math.round(num(raw.beatsPerBar, 4, 1, 16)),
    lengthBars: Math.round(num(raw.lengthBars, 16, 1, 512)),
    tracks: raw.tracks.map(parseTrack),
  }
}
