# Histórico de alterações

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
