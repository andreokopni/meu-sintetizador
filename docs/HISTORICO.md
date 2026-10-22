# Histórico de alterações

## 2026-10-21 — Publicação no GitHub
- Repositório público: https://github.com/andreokopni/meu-sintetizador (licença MIT).
- `LICENSE` novo; README revisado (recursos, requisitos, estado do projeto, licença).
- package.json com `license` e `repository`; CLAUDE.md e pendências atualizados.
- Release v0.1.0 no GitHub com o instalador Windows (`Meu-Sintetizador-Setup-0.1.0.exe`, ~125 MB,
  sem assinatura de código, ícone padrão do Electron). Gerado fora do Desktop por causa do EPERM;
  o app empacotado abriu normalmente antes da publicação.

## 2026-10-04 — Importar partituras; exemplos fora da barra
- "Abrir" virou menu: projeto do computador, importar partitura (MIDI, MusicXML, .mxl) e exemplos.
  O seletor "Exemplos…" saiu da barra.
- Importadores em `src/notation/` (importMidi, importMusicXml, unzip, gm), com escolha automática
  de instrumento e mapeamento de bateria GM.
- 45 testes (inclui ida e volta exportar→importar).

## 2026-10-04 — Partitura
- Botão "🎼 Partitura": janela com a partitura das faixas escolhidas (OpenSheetMusicDisplay),
  exportação em PDF, MusicXML (MuseScore etc.) e MIDI.
- Núcleo de notação em `src/notation/` (quantização, vozes, ligaduras, armadura, MusicXML, MIDI).
- Pour Elise: mão esquerda com durações exatas (partitura limpa).
- 38 testes.

## 2026-10-04 — Músicas de exemplo (domínio público)
- Seletor "Exemplos…" na barra: Ode à Alegria e Pour Elise (Beethoven), Cânone em Ré
  (Pachelbel), Brilha, Brilha Estrelinha (tradicional). Arranjos próprios em `src/model/examples.ts`.
- "Brilha, Brilha" usa um timbre do Construtor embutido no projeto ("Caixinha de música").
- Testes: cada exemplo é válido, cabe na duração e sobrevive a salvar/abrir (25 testes).

## 2026-10-04 — Criador de timbres (Meus timbres + Construtor)
- Instrumentos de fábrica passam a ser fixos (somente leitura); "Personalizar este som" cria
  um timbre do usuário editável. Biblioteca "Meus timbres" salva em arquivo (Electron) e
  embutida nos projetos que a usam.
- Novo instrumento "Construtor (criar timbre)": 2 osciladores com uníssono, sub, ruído, filtro
  com envelope, LFO, distorção/chorus/delay/reverb, 4 macros, 6 modelos.
- Construtor em janela própria com curvas de envelope, teclado de pré-escuta (mouse e teclado
  do computador), Variar, A/B e Desfazer tudo. Painel lateral mostra só os macros.
- Menu nativo do Electron removido; 19 testes.

## 2026-10-04 — Zoom vertical e painéis redimensionáveis
- Piano roll: zoom vertical (Alt+roda ou Ctrl+Shift+roda) ancorado no mouse; botões −/+ para
  zoom horizontal e vertical; linhas maiores por padrão (zoom vertical 1,4x).
- Divisória arrastável entre a área de faixas e o editor.
- Zoom e tamanho dos painéis lembrados entre sessões (localStorage, `src/ui/persist.ts`).
- Menu nativo do Electron removido (o Alt o exibia); F12 / Ctrl+Shift+I abrem DevTools, F5 recarrega.

## 2026-10-04 — Ajustes após o primeiro teste (bateria, lead, violão)
- Piano roll com modo bateria: uma linha por peça com nome; notas fora do kit ocultas com aviso.
- Bateria ganhou aro (37), condução (51) e cowbell (56).
- Sintetizadores subtrativos refeitos: filtro 24 dB/oit por nota com envelope (remove o chiado do
  lead); novos presets para Lead, Baixo, Pad, Órgão, Pluck; volume do subtrativo -10 → -6 dB.
- Violão trocado para samples de nylon (consistentes em toda a extensão).
- Samplers mostram a extensão natural no piano roll (área escura + borda laranja).
- Testes do layout do piano roll (12 testes no total).

## 2026-10-04 — Instalador
- Gerado `release/Meu Sintetizador Setup 0.1.0.exe` (NSIS, ~117 MB, não versionado no git).
  Precisou de saída fora da Área de Trabalho por causa de EPERM (ver PENDENCIAS).
- App empacotado testado: abre, carrega interface e samples pelo protocolo `app://`.

## 2026-10-04 — Versão inicial (v0.1.0)
- Projeto criado: Electron + React + TypeScript + Vite + Tone.js + Zustand.
- Modelo de projeto JSON versionado com validação/migração (`.msynth`).
- Instrumentos: Lead, Baixo sintetizado, Pad, Órgão, Pluck (subtrativos); Piano elétrico e Sino (FM);
  Bateria sintetizada; samplers de Piano acústico, Violão, Violino, Flauta, Baixo elétrico.
- Piano roll em canvas: criar, esticar, mover, apagar (botão direito), seleção múltipla
  (Shift/Ctrl + clique ou arrastar), grade/snap, zoom (Ctrl+roda), pré-escuta, notas fantasmas das outras faixas.
- Visão de arranjo com miniaturas, mute/solo/volume/pan, adicionar/remover faixas.
- Editor de timbre gerado pelos parâmetros de cada instrumento.
- Desfazer/refazer, atalhos (Espaço, Ctrl+Z/Y/S/O/A, Delete).
- Salvar/abrir via diálogos nativos; exportar WAV (renderização offline).
- Contratos para futura IA em `src/ai/types.ts`.
- Testes: serialização, mute/solo, codificador WAV (9 testes).
- Correções durante a verificação: exportação muito lenta (Tone.Offline + timers estrangulados →
  `render(false)`); chimbais/prato com MetalSynth custavam ~65 ms/nota → trocados por ruído filtrado
  (exportação da demo de 23 s → 7,5 s); CSP bloqueava o worker de relógio do Tone (`worker-src blob:`).
