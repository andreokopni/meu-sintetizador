# Meu Sintetizador — guia para o Claude

App desktop (Electron) para compor música: faixas numa linha do tempo, notas em piano roll,
instrumentos sintetizados ou por samples, reprodução, salvar/abrir e exportar WAV.
Visão futura: recursos com IA (voz cantada, música por prompt), samples do usuário, monetização.

**Sempre leia e atualize `docs/` ao alterar o projeto** (pedido explícito do usuário):
- `docs/DECISOES.md` — decisões de arquitetura e o porquê
- `docs/PENDENCIAS.md` — pendências, ideias e bugs conhecidos
- `docs/HISTORICO.md` — o que mudou em cada etapa/commit

Idioma: português (código em inglês, comentários/UI/docs em português).
Versionamento: git local, um commit por etapa verificada, sem remoto.

## Comandos (PowerShell; Node em `C:\Program Files\nodejs` — se `node` não for achado,
prefixe `$env:Path = "C:\Program Files\nodejs;" + $env:Path;`)
- `npm run dev` — abre o app no Electron com hot reload
- `npm run dev:web` — só a interface no navegador (http://localhost:5173); usa fallbacks web
- `npm test` — testes unitários (Vitest)
- `npm run build` — checagem de tipos + build
- `npm run dist` — gera instalador Windows em `release/`
- `node scripts/fetch-samples.mjs` — baixa novamente os samples para `public/samples`

Bash do Git está quebrado nesta máquina: use a ferramenta PowerShell. Ao editar arquivos com
acentos, use Edit/Write (Get-Content/Set-Content no PowerShell 5.1 corrompe UTF-8).

## Arquitetura (src/)
- `model/project.ts` — tipos do projeto (JSON puro; tempo em batidas). `serialization.ts` valida e migra por `version`.
- `audio/instruments/` — `types.ts` (InstrumentDefinition/Voice/ParamSpec), `registry.ts` (registro central,
  ponto de extensão), `synths.ts` (subtrativo, FM, bateria), `samplers.ts` (bibliotecas de samples via manifest).
- `audio/engine.ts` — motor ao vivo (Tone.js); `sync(project)` aplica diferenças por referência.
- `audio/scheduling.ts` — cria Tone.Part por faixa (usado no ao vivo e na exportação).
- `audio/exportWav.ts` + `wav.ts` — renderização offline e codificador WAV 16 bits.
- `store/useProjectStore.ts` — Zustand, estado imutável, desfazer/refazer (`apply`, `checkpoint`).
- `actions/` — transporte (tocar/parar) e arquivos (novo/abrir/salvar/exportar).
- `ui/` — Toolbar, Arrangement (faixas + visão geral), PianoRoll (canvas), InstrumentEditor (gerado por ParamSpec).
- `platform.ts` — usa `window.desktop` (preload do Electron) ou fallback do navegador.
- `ai/types.ts` — contratos para futura integração com IA (sem implementação).
- `electron/` — `main.ts` (janela, diálogos, protocolo `app://`), `preload.ts` (API segura).

Depuração: em dev, `window.__msynth` expõe `{ store, engine, renderProjectToWav }`.
