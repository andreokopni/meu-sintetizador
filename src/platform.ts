// Camada de plataforma: usa as APIs nativas do Electron quando disponíveis e
// cai para equivalentes do navegador (download / seletor de arquivo) na versão web.

interface DesktopApi {
  saveProject(json: string, filePath?: string, saveAs?: boolean): Promise<string | null>
  openProject(): Promise<{ filePath: string; json: string } | null>
  saveWav(data: ArrayBuffer, suggestedName: string): Promise<string | null>
  onCloseRequested(callback: () => void): void
  confirmClose(): Promise<void>
  loadTimbres(): Promise<string>
  saveTimbres(json: string): Promise<void>
}

declare global {
  interface Window {
    desktop?: DesktopApi
  }
}

export const isDesktop = typeof window !== 'undefined' && !!window.desktop

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function saveProjectFile(json: string, name: string, filePath?: string, saveAs = false) {
  if (window.desktop) return window.desktop.saveProject(json, filePath, saveAs)
  downloadBlob(new Blob([json], { type: 'application/json' }), `${name}.msynth`)
  return `${name}.msynth`
}

export async function openProjectFile(): Promise<{ filePath: string; json: string } | null> {
  if (window.desktop) return window.desktop.openProject()
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.msynth,.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      resolve(file ? { filePath: file.name, json: await file.text() } : null)
    }
    input.click()
  })
}

const TIMBRES_KEY = 'msynth.userTimbres'

/** Biblioteca de timbres do usuário (JSON). Desktop: arquivo em userData; web: localStorage. */
export async function loadTimbresJson(): Promise<string> {
  if (window.desktop) return window.desktop.loadTimbres()
  try {
    return localStorage.getItem(TIMBRES_KEY) ?? '[]'
  } catch {
    return '[]'
  }
}

export async function saveTimbresJson(json: string): Promise<void> {
  if (window.desktop) return window.desktop.saveTimbres(json)
  try {
    localStorage.setItem(TIMBRES_KEY, json)
  } catch {
    // sem armazenamento disponível (modo privado): o timbre vale só nesta sessão
  }
}

export async function saveWavFile(data: ArrayBuffer, name: string) {
  if (window.desktop) return window.desktop.saveWav(data, `${name}.wav`)
  downloadBlob(new Blob([data], { type: 'audio/wav' }), `${name}.wav`)
  return `${name}.wav`
}
