# Pendências, ideias e bugs conhecidos

Atualize ao concluir/descobrir algo. Marque `[x]` ao resolver e mova para o HISTORICO.

## CONCLUÍDO — Importar partituras + exemplos fora da barra (pedido em 2026-10-04)
Verificado com arquivos reais (repositório de testes do OSMD): Clementi Sonatina, Schumann
Dichterliebe, Joplin The Entertainer, Bach Air (cello → Pad). Não verificado: diálogo nativo de
abrir no Electron e um MIDI real de terceiros (só ida e volta com o nosso exportador).
- [x] A. Exemplos saem da barra: botão "Abrir" vira menu (Projeto do computador… / Importar
  partitura (MIDI, MusicXML)… / Exemplos). Sem botões novos na barra.
- [x] B. `notation/importMidi.ts`: SMF 0/1, running status, tempo, compasso, nomes, programa GM
  → instrumento; canal 10 → bateria com mapeamento de peças GM fora do kit para a mais próxima.
- [x] C. `notation/importMusicXml.ts` (DOMParser): partwise, divisions, chord, backup/forward,
  ligaduras, tempo, compasso, midi-program/nome da parte → instrumento; percussão.
  `notation/unzip.ts` para `.mxl` (ZIP; DecompressionStream deflate-raw). Repetições não são
  expandidas (limitação v1).
- [x] D. IPC `file:open` (binário), ação `importScore`, testes (happy-dom para DOMParser), docs.
- Limitações da importação: repetições/voltas não expandidas; só o 1º andamento e o 1º compasso
  (mudanças no meio da música são ignoradas); compassos como 3/8 e 6/8 viram batidas inteiras
  arredondadas; PDF não importa (converter com MuseScore "Importar PDF" ou Audiveris).
  Faixa de extensão dos samplers duplicada em `notation/gm.ts` (SAMPLER_RANGES) — atualizar se
  os samples mudarem.
- Ao matar o `npx vite` com TaskStop, o processo node filho continuou ouvindo a porta 5173;
  liberar com Get-NetTCPConnection -LocalPort 5173 | Stop-Process.

## CONCLUÍDO (aguardando teste do usuário) — Partitura (pedido em 2026-10-04, escopo "completo")
Verificado no navegador: Pour Elise e Ode à Alegria desenham corretamente (piano em pauta dupla,
bateria em pauta de percussão). **Não verificado: geração do PDF no Electron** (depende do
diálogo nativo de salvar). Se o PDF sair cortado/em branco, revisar `@media print` em styles.css
e `exportPdf` em `ui/ScoreModal.tsx` (redesenha com 720 px antes de imprimir).
Plano:
- [x] A. `src/notation/` puro (sem Tone, testável): `quantize.ts` (grade de 1/16, vozes, acordes,
  divisão em compassos, ligaduras, valores pontuados alinhados ao tempo), `key.ts` (detecção de
  armadura), `musicxml.ts` (MusicXML 4.0 partwise; piano em pauta dupla; bateria em pauta de
  percussão GM), `midi.ts` (SMF tipo 1, PPQ 480, canal 10 para bateria).
- [x] B. Janela "Partitura" (`ui/ScoreModal.tsx`) com OpenSheetMusicDisplay (carregado sob
  demanda), escolha das faixas, exportar MusicXML / MIDI / PDF (Electron `printToPDF` via IPC;
  web: window.print). Botão "Partitura" na barra.
- [x] C. Testes, docs, commit. Limitações v1: sem quiálteras (arredonda para 1/16); compasso =
  beatsPerBar/4 (Pour Elise aparece em 3/4 com valores dobrados); anacruse vira compasso com
  pausa; baixo escrito na altura real (convenção seria uma oitava acima); no máximo 2 vozes por
  pauta. Ideias: quiálteras, campo "unidade de tempo" no projeto (3/8, 6/8), editar título/autor.

## CONCLUÍDO (aguardando teste do usuário) — Criador de timbres (pedido em 2026-10-04)
Objetivo: nível 1 (salvar timbre como "Meu timbre") + nível 2 (sintetizador construtor), sem
poluir o visual atual. Passos:
- [x] A. `setTrackParams` em lote no store; `customTimbres` opcional no projeto (serialização).
- [x] B. Nível 1: biblioteca de timbres do usuário (`audio/instruments/userTimbres.ts`), persistida
  em arquivo `userData/timbres.json` via IPC no Electron (localStorage na web); categoria
  "Meus timbres" no seletor; timbres usados no projeto são embutidos no `.msynth`.
  **Regra do usuário: instrumentos de fábrica são FIXOS (somente leitura).** O painel mostra só
  mixagem + "Personalizar este som" (cria "<nome> (meu)"). Timbres do usuário são editáveis e a
  edição vai direto para o timbre (salvo com atraso de 600 ms), valendo para todas as faixas que o
  usam. Rodapé: Duplicar / Excluir (ao excluir, faixas voltam ao base com os mesmos parâmetros).
- [x] C. (feito; ver DECISOES "Construtor") Motor do construtor (`audio/instruments/builder.ts`): pool de vozes próprio (não
  PolySynth), por voz: osc1, osc2 (OmniOscillator com uníssono), sub, ruído → filtro 24 dB com
  FrequencyEnvelope → AmplitudeEnvelope; compartilhado: LFO (vibrato/filtro), tremolo,
  distorção, chorus, delay, reverb (Freeverb, síncrono). 4 macros fixos (Brilho, Ataque,
  Espaço, Movimento) que escalam outros parâmetros. Tudo declarado como ParamSpec (IA usa isso).
- [x] D. UI (`ui/BuilderModal.tsx`): painel lateral mostra só macros + "Abrir construtor"; o
  construtor abre em modal com 9 blocos, curvas de envelope (SVG), teclado de pré-escuta (mouse,
  teclas A-K, Z/X oitava), modelos, Variar, A/B e "Desfazer tudo". Fluxo: escolher
  "Construtor (criar timbre)" no seletor da faixa → "Personalizar" → cria "Meu timbre N" e abre.
- [x] E. Testes (macros, variar, customTimbres), docs, commit.
- [ ] Ideias seguintes: modelos de fábrica mais variados; desenhar forma de onda dos osciladores;
  macros configuráveis; gerar timbre por texto com IA (preencher BUILDER_PARAMS); excluir/renomear
  timbres pelo seletor; exportar/importar pacote de timbres (.json) — base para venda de presets.
Detalhe técnico importante: no Tone, conectar um sinal a um Param ZERA o valor do Param; por isso
modulações aditivas (vibrato no detune, LFO no corte) usam um Tone.Signal de base + o modulador,
ambos conectados ao Param (as conexões de áudio somam).

## Publicação (GitHub, release v0.1.0 em 2026-10-21)
- [ ] App sem ícone próprio (usa o padrão do Electron): criar `build/icon.ico` (256 px) e gerar
  novo release.
- [ ] Instalador sem assinatura de código: SmartScreen avisa quem baixa (documentado no README).
- [ ] Instalador do release não testado em máquina limpa (só o app empacotado foi aberto).
- [ ] Sem CI: releases são gerados à mão nesta máquina (ver "Novos releases" abaixo).
- [ ] Sem `CONTRIBUTING.md` / modelos de issue — criar se aparecerem contribuidores.

## Verificação pendente
- [ ] **Ouvir a reprodução ao vivo no app.** A automação de teste não consegue liberar o áudio
  (política de autoplay do navegador) nem ouvir o resultado. Verificado por script: renderização
  offline de cada faixa produz áudio (RMS > 0), sem clipping, mute/solo corretos; edição de notas
  (criar, esticar, mover, desfazer, apagar) via eventos sintéticos. Falta o usuário ouvir e testar
  tocar/parar, loop e pré-escuta de notas.
- [ ] Testar o instalador gerado por `npm run dist` numa instalação limpa. O app empacotado
  (`win-unpacked`) já foi aberto com sucesso: interface e samples carregam sem erros.
- [ ] Confirmar a mensagem "The AudioContext encountered an error from the audio device" vista no
  log do app empacotado — apareceu no instante em que o processo foi morto à força no teste;
  provavelmente inofensiva.

## Bugs / limitações conhecidas
- **Desempenho do construtor em tempo real não medido.** Na exportação (aba oculta, mais lenta):
  16 notas em 5 s de áudio custam 1,5 s (Básico) a 6,7 s (Pad: uníssono 5 + chorus + reverb).
  Se engasgar ao vivo: reduzir MAX_VOICES (12), limitar uníssono (7) ou encurtar o reverb.
- Ligar/desligar um efeito do construtor durante a reprodução religa a cadeia (pode dar um clique).
- Vozes do construtor criadas sob demanda nunca são destruídas até o instrumento ser descartado.
- Log `ERROR:ui\gl\direct_composition_support.cc ... AMD VideoProcessorGetOutputExtension failed`
  no terminal do Electron (relatado pelo usuário, GPU AMD). É do Chromium tentando um recurso de
  vídeo do driver AMD; inofensivo para o app (não usamos vídeo). Se incomodar, testar
  `app.commandLine.appendSwitch('disable-features', 'DirectCompositionVideoOverlays')` — não testado.
- Projetos salvos em que o usuário editou o timbre do Lead/Baixo/Pad/Órgão/Pluck guardam os
  parâmetros antigos (corte/ressonância pensados para o filtro antigo) e podem soar diferentes.
- O envelope do filtro usa sustain fixo (0,25) e não acompanha a altura da nota (sem keytracking).
- Notas de uma faixa melódica trocada para bateria ficam ocultas (aviso no rodapé do piano roll).
- Ouvir de novo: lead, pluck e violão (nylon) após as mudanças — verificados só por análise.
- Durante a exportação WAV, o contexto global do Tone fica trocado pelo offline enquanto os samples
  carregam (`await ready`). A interface fica bloqueada pelo overlay "Renderizando…", então nada
  deveria tocar nesse intervalo — mas qualquer código que crie nós Tone ali iria para o contexto errado.
- Exportação em aba de navegador oculta é mais lenta (renderização offline em segundo plano é
  estrangulada). No Electron, `backgroundThrottling: false` minimiza isso.
- Mudar o BPM/compassos digitando cria uma entrada de desfazer por tecla.
- Focar o nome da faixa cria um ponto de desfazer mesmo sem alteração.
- Projeto com instrumento inexistente (ex.: samples ausentes) toca com o instrumento "Lead"
  (`FALLBACK_INSTRUMENT_ID`) sem avisar o usuário.
- `npm install` do Electron: o npm 11 pode não rodar o script de instalação do binário. Se
  `node_modules/electron/dist/electron.exe` não existir, rode `node node_modules/electron/install.js`.
- `npm run dist` falha com `EPERM ... rename release\win-unpacked.tmp` quando a saída fica na
  Área de Trabalho (bloqueio do Windows/antivírus ou do sandbox do Claude Code nessa pasta).
  Contorno: `npx electron-builder --win --config.directories.output=<pasta fora do Desktop>` e
  copiar o `.exe`. Se acontecer com o usuário também, considerar mover o projeto para fora do Desktop
  (ex.: `C:\dev\meu-sintetizador`) ou desativar o Acesso Controlado a Pastas para o node.exe.
- Bundle JS ~515 kB (Tone.js é a maior parte) — irrelevante no desktop; para a versão web, dividir.

## Próximas funcionalidades (sugestões)
- Carregar samples do usuário (pasta ou arquivos) — `registerSampleLibrary` já está pronto;
  falta UI, cópia dos arquivos para a pasta do usuário (`app.getPath('userData')`) e salvar referência no projeto.
- Copiar/colar e duplicar notas; quantizar; editar velocity (painel inferior).
- Efeitos por faixa (reverb, delay, compressor) e master.
- Fórmula de compasso editável na UI (o modelo já tem `beatsPerBar`).
- Região de loop selecionável na régua.
- Tocar com teclado do computador ou controlador MIDI (Web MIDI). (Importar/exportar MIDI já existe.)
- Faixas de áudio (necessárias para voz gerada por IA).
- IA: implementar `src/ai/types.ts` (gerar música por prompt, voz cantada). Provável backend
  Python (FastAPI) iniciado pelo Electron, ou APIs na nuvem.
- Novos releases: subir `version` no package.json, gerar com `npx electron-builder --win
  --config.directories.output=<pasta fora do Desktop>` e `gh release create vX.Y.Z <exe>`.
  Ideia: GitHub Actions para gerar o instalador automaticamente a cada tag.
- Monetização: ícone, assinatura de código (evita alerta do SmartScreen), auto-update, licenças.
