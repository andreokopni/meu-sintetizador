// Camada de plataforma: usa as APIs nativas do Electron quando disponíveis e
// cai para equivalentes do navegador (download / seletor de arquivo) na versão web.

interface DesktopApi {
  saveProject(json: string, filePath?: string, saveAs?: boolean): Promise<string | null>
  openProject(): Promise<{ filePath: string; json: string } | null>
  saveWav(data: ArrayBuffer, suggestedName: string): Promise<string | null>
  onCloseRequested(callback: () => void): void
  confirmClose(): Promise<void>
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

export async function saveWavFile(data: ArrayBuffer, name: string) {
  if (window.desktop) return window.desktop.saveWav(data, `${name}.wav`)
  downloadBlob(new Blob([data], { type: 'audio/wav' }), `${name}.wav`)
  return `${name}.wav`
}
