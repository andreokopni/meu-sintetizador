import { renderProjectToWav } from '../audio/exportWav'
import { registerProjectTimbres, timbresUsedBy } from '../audio/instruments/userTimbres'
import { createEmptyProject } from '../model/project'
import { parseProject, serializeProject } from '../model/serialization'
import { openProjectFile, saveProjectFile, saveWavFile } from '../platform'
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
