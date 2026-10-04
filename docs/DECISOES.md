# Decisões de arquitetura

Registro das decisões e do motivo de cada uma. Mais recentes no fim.

## 2026-10-04 — Base do projeto

**Electron + React + TypeScript + Vite, áudio com Tone.js.**
O usuário quer recursos de IA no futuro e talvez monetizar; pediu algo que não fosse só web.
Electron dá app desktop instalável e o mesmo frontend pode virar versão web/SaaS. Para IA, o
Electron pode iniciar um backend Python (FastAPI) como processo "sidecar" (onde está o ecossistema
de modelos de voz/música) ou chamar APIs na nuvem. Alternativas descartadas: Python/Qt (síntese em
tempo real e piano roll mais trabalhosos), Tauri (exige Rust; mais difícil para o usuário manter).

**Projeto como JSON puro, tempo em batidas (beats), com `version` e migrações.**
Fácil de salvar, de versionar e de uma IA gerar/editar. BPM pode mudar sem reescrever notas.
Arquivo: `.msynth` (JSON dentro; campo `format: "meu-sintetizador"`). Usei `.msynth` em vez de
`.msynth.json` porque filtros de diálogo do Electron não lidam bem com extensão de dois pontos.

**Registro de instrumentos com `InstrumentDefinition` + `ParamSpec`.**
Todo instrumento declara seus parâmetros; o editor de timbre é gerado a partir deles. Novos tipos
(samples do usuário, vozes de IA, plugins) entram via `registerInstrument` / `registerSampleLibrary`
sem mexer na interface. Parâmetros da faixa guardam só o que difere (`params: {}` = padrões);
`effectiveParams()` completa com os padrões do instrumento.

**Samples empacotados em `public/samples` com `manifest.json`** (gerados por `scripts/fetch-samples.mjs`).
Piano Salamander + tonejs-instruments, ambos CC-BY 3.0 (uso comercial com atribuição — ver
`public/samples/CREDITS.md`). ~14 MB, versionados no git. Um sample a cada ~3 semitons; o
Tone.Sampler interpola o resto. Samples do usuário no futuro usarão o mesmo formato `SampleLibrary`.

**Protocolo `app://` no Electron em produção.**
`fetch()` de `file://` não funciona no Chromium e o Tone carrega samples via fetch. O handler
valida o caminho (bloqueia `..`) e adiciona Content-Security-Policy nas páginas HTML.

**Estado em Zustand, imutável; motor de áudio sincroniza por referência.**
`engine.sync(project)` é chamado a cada mudança e só reconstrói o que mudou (instrumento,
parâmetros, notas). Desfazer/refazer guarda snapshots do projeto (barato por compartilhamento
estrutural). Gestos de arrastar chamam `checkpoint()` uma vez e depois `apply(..., false)`.

**Piano roll em Canvas 2D com rolagem virtual.**
Um div transparente rolável por cima do canvas fornece as barras de rolagem; o canvas desenha só
a área visível. Evita canvas gigantes e mantém desempenho com muitas notas.

**Exportação WAV: OfflineContext do Tone com `render(false)`.**
`Tone.Offline` pausa com `setTimeout` a cada segundo de áudio; com a janela em segundo plano o
navegador atrasa esses timers e a exportação ficava muito lenta. Também desliguei
`backgroundThrottling` na janela do Electron (app de áudio não deve ser estrangulado).

**Plataforma abstraída em `src/platform.ts`.**
Usa `window.desktop` (preload) quando existe; senão faz download/seletor de arquivo do navegador.
Permite rodar a interface no navegador (`npm run dev:web`) para testes e para uma futura versão web.

## 2026-10-04 — Ajustes após o primeiro teste do usuário

**Modo bateria no piano roll (`InstrumentDefinition.rows`).**
O usuário achou estranho as peças da bateria espalhadas pelo teclado de piano, e notas fora delas
não faziam nada. Agora, se o instrumento declara `rows`, o piano roll mostra só essas linhas (uma
por peça, 30 px, com nome), notas novas nascem com o tamanho da grade e mover na vertical troca de
peça. A lógica de linhas fica em `ui/rollLayout.ts` (pura, testada). Notas fora do kit (ex.: faixa
melódica trocada para bateria) ficam ocultas, com aviso no rodapé. Peças seguem o General MIDI
(36 bumbo, 38 caixa, 42 chimbal…) para facilitar MIDI no futuro. Kit ampliado: aro, condução, cowbell.

**Subtrativo com filtro por nota (PolySynth de MonoSynth, 24 dB/oit) e envelope de filtro.**
O lead tinha "chiado" em algumas notas. Não era volume alto (pico 0,39, sem clipping): era um
filtro único de 12 dB/oitava, com ressonância 2 fixa em 4 kHz, sobre dente de serra, que realçava
os harmônicos agudos das notas altas. Novo parâmetro "Abertura pelo envelope" (oitavas) e
"Fechamento do filtro" (s); sustain do envelope do filtro fixo em 0,25. Ressonância limitada a 12.

**Violão: guitar-nylon em vez de guitar-acoustic.**
A análise dos samples mostrou que no guitar-acoustic as notas a partir de G3 são outra gravação
(sustentação cai de ~7 s para ~1,5 s de repente) — o usuário percebeu como "vira piano em
algumas notas". O nylon decai de forma gradual. O id continua `sample:guitar` (projetos antigos
seguem abrindo).

**Extensão natural dos samplers (`InstrumentDefinition.range`).**
Sample mais grave/agudo ± 4 semitons. Fora disso o piano roll escurece a grade (borda laranja),
porque o reajuste extremo de altura soa artificial.

## 2026-10-04 — Zoom e layout

**Zoom vertical com Alt+roda; sem menu nativo no Electron.**
Ctrl+roda já era o zoom horizontal (padrão de DAWs). Alt+roda faz o vertical (Ctrl+Shift+roda
também, alternativa). No Electron, soltar o Alt mostra o menu escondido, então o menu nativo foi
removido (`Menu.setApplicationMenu(null)`) e os atalhos de desenvolvedor recriados via
`before-input-event`.

**Rolagem de âncora aplicada em `useLayoutEffect`, não em `requestAnimationFrame`.**
O rAF não roda com a janela oculta e pode atrasar um quadro (salto visível). O ajuste fica
pendente num ref e é aplicado logo após o React redimensionar o conteúdo.

**Preferências de interface no localStorage (`ui/persist.ts`).**
São conveniências por usuário (zoom, altura do painel); não vão para o arquivo do projeto.
