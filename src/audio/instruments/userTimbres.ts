// Biblioteca "Meus timbres": instrumentos base com parâmetros salvos pelo usuário.
// Cada timbre vira um InstrumentDefinition derivado do base (mesmo motor e controles,
// padrões = parâmetros salvos), registrado na categoria "Meus timbres".

import { uid, type ParamValue, type ParamValues, type Project, type UserTimbre } from '../../model/project'
import { parseUserTimbres } from '../../model/serialization'
import { loadTimbresJson, saveTimbresJson } from '../../platform'
import { getInstrument, hasInstrument, registerInstrument, unregisterInstrument } from './registry'
import type { InstrumentDefinition } from './types'

let library: UserTimbre[] = []
/** Timbres registrados a partir de um projeto aberto, que não estão na biblioteca. */
const embedded = new Map<string, UserTimbre>()

export function isUserTimbre(instrumentId: string): boolean {
  return instrumentId.startsWith('user:')
}

function definitionFor(timbre: UserTimbre): InstrumentDefinition {
  const base = getInstrument(timbre.baseInstrumentId)
  return {
    ...base,
    id: timbre.id,
    name: timbre.name,
    category: 'Meus timbres',
    defaults: { ...base.defaults, ...timbre.params },
  }
}

function register(timbre: UserTimbre) {
  registerInstrument(definitionFor(timbre))
}

async function persist() {
  clearTimeout(persistTimer)
  await saveTimbresJson(JSON.stringify(library, null, 2))
}

let persistTimer: ReturnType<typeof setTimeout> | undefined

/** Grava com atraso (edição contínua em sliders não escreve no disco a cada movimento). */
function persistSoon() {
  clearTimeout(persistTimer)
  persistTimer = setTimeout(() => void persist(), 600)
}

/** Carrega a biblioteca do usuário. Chamar depois que os instrumentos base estiverem registrados. */
export async function initUserTimbres() {
  try {
    library = parseUserTimbres(JSON.parse(await loadTimbresJson()))
  } catch (err) {
    console.warn('Biblioteca de timbres ilegível; começando vazia.', err)
    library = []
  }
  library.forEach(register)
}

export function getUserTimbre(id: string): UserTimbre | undefined {
  return library.find((t) => t.id === id)
}

/**
 * Salva um novo timbre. Se `instrumentId` já for um timbre do usuário, o novo herda
 * o mesmo instrumento base (nunca se cria timbre de timbre).
 */
export async function createUserTimbre(name: string, instrumentId: string, params: ParamValues): Promise<UserTimbre> {
  const baseInstrumentId = isUserTimbre(instrumentId)
    ? (getTimbre(instrumentId)?.baseInstrumentId ?? instrumentId)
    : instrumentId
  const timbre: UserTimbre = { id: `user:${uid()}`, name: name.trim() || 'Meu timbre', baseInstrumentId, params: { ...params } }
  library = [...library, timbre]
  register(timbre)
  await persist()
  return timbre
}

/**
 * Edita um timbre do usuário (os instrumentos de fábrica são fixos; só timbres do usuário
 * mudam). Vale na hora para todas as faixas que o usam e é gravado na biblioteca.
 * Timbres que vieram embutidos num projeto aberto (fora da biblioteca) passam a fazer parte dela.
 */
export function editUserTimbre(id: string, change: { params?: ParamValues; name?: string }) {
  let timbre = getUserTimbre(id) ?? embedded.get(id)
  if (!timbre) return
  timbre = { ...timbre, ...(change.params ? { params: { ...change.params } } : {}), name: change.name ?? timbre.name }
  library = getUserTimbre(id) ? library.map((t) => (t.id === id ? timbre! : t)) : [...library, timbre]
  embedded.delete(id)
  register(timbre)
  persistSoon()
}

export function setUserTimbreParam(id: string, key: string, value: ParamValue) {
  const timbre = getUserTimbre(id) ?? embedded.get(id)
  if (timbre) editUserTimbre(id, { params: { ...definitionFor(timbre).defaults, [key]: value } })
}

export async function deleteUserTimbre(id: string) {
  library = library.filter((t) => t.id !== id)
  embedded.delete(id)
  unregisterInstrument(id)
  await persist()
}

/** Timbres do usuário usados pelas faixas — embutidos no arquivo ao salvar. */
export function timbresUsedBy(project: Project): UserTimbre[] {
  const used = new Set(project.tracks.map((t) => t.instrumentId).filter(isUserTimbre))
  return [...used].map((id) => getTimbre(id) ?? project.customTimbres?.find((t) => t.id === id)).filter(
    (t): t is UserTimbre => !!t,
  )
}

/**
 * Ao abrir um projeto: registra (só nesta sessão) os timbres embutidos que não estão
 * na biblioteca deste computador, para o projeto tocar igual. Não altera a biblioteca.
 */
export function registerProjectTimbres(project: Project) {
  for (const timbre of project.customTimbres ?? []) {
    if (!hasInstrument(timbre.id)) {
      embedded.set(timbre.id, timbre)
      register(timbre)
    }
  }
}

export function getTimbre(id: string): UserTimbre | undefined {
  return getUserTimbre(id) ?? embedded.get(id)
}
