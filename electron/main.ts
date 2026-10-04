import { app, BrowserWindow, dialog, ipcMain, net, protocol } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const DIST_DIR = path.join(__dirname, '../dist')
const PROJECT_FILTERS = [{ name: 'Projeto Meu Sintetizador', extensions: ['msynth'] }]
const CSP =
  // worker-src blob: — o Tone.js cria o worker do relógio de áudio a partir de um blob.
  "default-src 'self'; script-src 'self'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; " +
  "media-src 'self' blob: data:; connect-src 'self' blob: data:; img-src 'self' data:"

// App de música: o áudio pode começar sem exigir um clique antes (política de autoplay).
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

// Em produção a interface é servida pelo protocolo app:// (o fetch de file:// não
// funciona no Chromium, e os samples são carregados via fetch).
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

let win: BrowserWindow | null = null
let forceClose = false

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#14141b',
    title: 'Meu Sintetizador',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // App de áudio: não reduzir timers/animação com a janela em segundo plano.
      backgroundThrottling: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadURL('app://bundle/index.html')
  }

  // Avisa a interface antes de fechar, para ela poder perguntar sobre alterações não salvas.
  win.on('close', (event) => {
    if (forceClose) return
    event.preventDefault()
    win?.webContents.send('app:close-requested')
  })
}

function registerAppProtocol() {
  protocol.handle('app', async (request) => {
    const { pathname } = new URL(request.url)
    const filePath = path.normalize(path.join(DIST_DIR, decodeURIComponent(pathname)))
    if (!filePath.startsWith(DIST_DIR)) {
      return new Response('Acesso negado', { status: 403 })
    }
    const response = await net.fetch(pathToFileURL(filePath).toString())
    if (filePath.endsWith('.html')) {
      const headers = new Headers(response.headers)
      headers.set('Content-Security-Policy', CSP)
      return new Response(response.body, { status: response.status, headers })
    }
    return response
  })
}

ipcMain.handle('project:save', async (_event, args: { json: string; filePath?: string; saveAs?: boolean }) => {
  let target = args.saveAs ? undefined : args.filePath
  if (!target) {
    const result = await dialog.showSaveDialog(win!, {
      title: 'Salvar projeto',
      defaultPath: args.filePath ?? 'Minha música.msynth',
      filters: PROJECT_FILTERS,
    })
    if (result.canceled || !result.filePath) return null
    target = result.filePath
  }
  await fs.writeFile(target, args.json, 'utf-8')
  return target
})

ipcMain.handle('project:open', async () => {
  const result = await dialog.showOpenDialog(win!, {
    title: 'Abrir projeto',
    filters: PROJECT_FILTERS,
    properties: ['openFile'],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  const filePath = result.filePaths[0]
  const json = await fs.readFile(filePath, 'utf-8')
  return { filePath, json }
})

ipcMain.handle('wav:save', async (_event, args: { data: ArrayBuffer; suggestedName: string }) => {
  const result = await dialog.showSaveDialog(win!, {
    title: 'Exportar WAV',
    defaultPath: args.suggestedName,
    filters: [{ name: 'Áudio WAV', extensions: ['wav'] }],
  })
  if (result.canceled || !result.filePath) return null
  await fs.writeFile(result.filePath, Buffer.from(args.data))
  return result.filePath
})

ipcMain.handle('app:confirm-close', () => {
  forceClose = true
  win?.close()
})

app.whenReady().then(() => {
  registerAppProtocol()
  createWindow()
})

app.on('window-all-closed', () => {
  app.quit()
})
