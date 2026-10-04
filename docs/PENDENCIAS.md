# Pendências, ideias e bugs conhecidos

Atualize ao concluir/descobrir algo. Marque `[x]` ao resolver e mova para o HISTORICO.

## Verificação pendente
- [ ] **Ouvir a reprodução ao vivo no app.** A automação de teste não consegue liberar o áudio
  (política de autoplay do navegador) nem ouvir o resultado. Verificado por script: renderização
  offline de cada faixa produz áudio (RMS > 0), sem clipping, mute/solo corretos; edição de notas
  (criar, esticar, mover, desfazer, apagar) via eventos sintéticos. Falta o usuário ouvir e testar
  tocar/parar, loop e pré-escuta de notas.
- [ ] Testar o instalador gerado por `npm run dist` numa instalação limpa.

## Bugs / limitações conhecidas
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
- Bundle JS ~515 kB (Tone.js é a maior parte) — irrelevante no desktop; para a versão web, dividir.

## Próximas funcionalidades (sugestões)
- Carregar samples do usuário (pasta ou arquivos) — `registerSampleLibrary` já está pronto;
  falta UI, cópia dos arquivos para a pasta do usuário (`app.getPath('userData')`) e salvar referência no projeto.
- Copiar/colar e duplicar notas; quantizar; editar velocity (painel inferior).
- Efeitos por faixa (reverb, delay, compressor) e master.
- Fórmula de compasso editável na UI (o modelo já tem `beatsPerBar`).
- Região de loop selecionável na régua.
- Importar/exportar MIDI; tocar com teclado do computador ou controlador MIDI (Web MIDI).
- Faixas de áudio (necessárias para voz gerada por IA).
- IA: implementar `src/ai/types.ts` (gerar música por prompt, voz cantada). Provável backend
  Python (FastAPI) iniciado pelo Electron, ou APIs na nuvem.
- Monetização: ícone, assinatura de código (evita alerta do SmartScreen), auto-update, licenças.
