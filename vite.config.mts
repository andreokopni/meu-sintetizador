/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'

// `npm run dev` abre o app no Electron; `npm run dev:web` roda só no navegador.
export default defineConfig(({ mode }) => ({
  base: './',
  // App desktop carregado localmente: um bundle único de ~500 kB não é problema.
  build: { chunkSizeWarningLimit: 1000 },
  plugins: [
    react(),
    mode !== 'web' &&
      electron({
        main: { entry: 'electron/main.ts' },
        preload: { input: 'electron/preload.ts' },
      }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}))
