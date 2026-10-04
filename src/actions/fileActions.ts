import { renderProjectToWav } from '../audio/exportWav'
import { registerProjectTimbres, timbresUsedBy } from '../audio/instruments/userTimbres'
import { EXAMPLES } from '../model/examples'
import { createEmptyProject } from '../model/project'
import { parseProject, serializeProject } from '../model/serialization'
import { importMidi } from '../notation/importMidi'
import { importMusicXml } from '../notation/importMusicXml'
import { readMxl } from '../notation/unzip'
import { openBinaryFile, openProjectFile, saveProjectFile, saveWavFile } from '../platform'
import { useProjectStore } from '../store/useProjectStore'
import { stopPlayback } from './transport'

const store = () => useProjectStore.getState()

/** Pergunta antes de descartar alterações não salvas. */
export function confirmDiscard(): boolean {
  return !store().dirty || window.confirm('Há alterações não salvas. Deseja descartá-las?')
}

export function newProject() {
  if (!confirmDiscard()) return
  stopPlayback()
  store().loadProject(createEmptyProject(), null)
  store().addTrack('sample:piano')
  useProjectStore.setState({ dirty: false, past: [] })
}

/** Abre uma das músicas de exemplo (como projeto novo, sem arquivo associado). */
export function openExample(id: string) {
  const example = EXAMPLES.find((e) => e.id === id)
  if (!example || !confirmDiscard()) return
  stopPlayback()
  const project = example.create()
  registerProjectTimbres(project)
  store().loadProject(project, null)
}

const SCORE_EXTENSIONS = ['mid', 'midi', 'musicxml', 'xml', 'mxl']

/** Importa uma partitura (MIDI, MusicXML ou .mxl) como projeto novo. */
export async function importScore() {
  if (!confirmDiscard()) return
  const file = await openBinaryFile('Importar partitura', 'Partituras (MIDI, MusicXML)', SCORE_EXTENSIONS)
  if (!file) return
  try {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    let project
    if (ext === 'mid' || ext === 'midi') project = importMidi(file.data, file.name)
    else if (ext === 'mxl') project = importMusicXml(await readMxl(file.data), file.name)
    else project = importMusicXml(new TextDecoder().decode(file.data), file.name)
    stopPlayback()
    store().loadProject(project, null)
    useProjectStore.setState({ dirty: true }) // ainda não foi salvo como .msynth
  } catch (err) {
    window.alert(`Não foi possível importar: ${(err as Error).message}`)
  }
}

export async function openProject() {
  if (!confirmDiscard()) return
  const file = await openProjectFile()
  if (!file) return
  try {
    const project = parseProject(file.json)
    stopPlayback()
    registerProjectTimbres(project)
    store().loadProject(project, file.filePath)
  } catch (err) {
    window.alert((err as Error).message)
  }
}

export async function saveProject(saveAs = false): Promise<boolean> {
  const { project, filePath } = store()
  try {
    // Embute os timbres do usuário usados, para o projeto tocar igual em outro computador.
    const timbres = timbresUsedBy(project)
    const toSave = { ...project, customTimbres: timbres.length ? timbres : undefined }
    const saved = await saveProjectFile(serializeProject(toSave), project.name, filePath ?? undefined, saveAs)
    if (!saved) return false
    store().markSaved(saved)
    return true
  } catch (err) {
    window.alert(`Erro ao salvar: ${(err as Error).message}`)
    return false
  }
}

export async function exportWav() {
  const { project, setBusy } = store()
  if (!project.tracks.some((t) => t.notes.length)) {
    window.alert('O projeto não tem notas para exportar.')
    return
  }
  stopPlayback()
  setBusy('Renderizando áudio…')
  try {
    const wav = await renderProjectToWav(project)
    setBusy(null)
    await saveWavFile(wav, project.name)
  } catch (err) {
    window.alert(`Erro ao exportar: ${(err as Error).message}`)
  } finally {
    setBusy(null)
  }
}
