import { contextBridge, ipcRenderer } from 'electron'

// API mínima e segura exposta para a interface (window.desktop).
contextBridge.exposeInMainWorld('desktop', {
  saveProject: (json: string, filePath?: string, saveAs?: boolean) =>
    ipcRenderer.invoke('project:save', { json, filePath, saveAs }),
  openProject: () => ipcRenderer.invoke('project:open'),
  saveWav: (data: ArrayBuffer, suggestedName: string) =>
    ipcRenderer.invoke('wav:save', { data, suggestedName }),
  // Só um ouvinte por vez (evita diálogos duplicados com StrictMode/hot reload).
  onCloseRequested: (callback: () => void) => {
    ipcRenderer.removeAllListeners('app:close-requested')
    ipcRenderer.on('app:close-requested', () => callback())
  },
  confirmClose: () => ipcRenderer.invoke('app:confirm-close'),
  openFile: (title: string, filterName: string, extensions: string[]) =>
    ipcRenderer.invoke('file:open', { title, filterName, extensions }),
  saveFile: (data: string | ArrayBuffer, suggestedName: string, filterName: string, extensions: string[]) =>
    ipcRenderer.invoke('file:save', { data, suggestedName, filterName, extensions }),
  saveScorePdf: (suggestedName: string) => ipcRenderer.invoke('score:pdf', suggestedName),
  loadTimbres: () => ipcRenderer.invoke('timbres:load'),
  saveTimbres: (json: string) => ipcRenderer.invoke('timbres:save', json),
})
