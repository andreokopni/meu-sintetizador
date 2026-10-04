import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { loadBuiltinSamples } from './audio/instruments/registry'
import App from './App'
import { engine } from './audio/engine'
import { renderProjectToWav } from './audio/exportWav'
import { useProjectStore } from './store/useProjectStore'
import './styles.css'

// Gancho de depuração (só em desenvolvimento): window.__msynth no console.
if (import.meta.env.DEV) {
  ;(window as any).__msynth = { store: useProjectStore, engine, renderProjectToWav }
}

// Os samples embutidos são registrados antes da primeira renderização para que
// o projeto de demonstração encontre seus instrumentos.
loadBuiltinSamples().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
