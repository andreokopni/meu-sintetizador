# Meu Sintetizador

Sintetizador multifaixa com piano roll: componha notas em várias faixas, escolha o instrumento
de cada uma (sintetizado ou por samples), ajuste o timbre, toque tudo junto e exporte em WAV.

## Rodando
```
npm install
npm run dev        # abre o app (Electron)
npm run dev:web    # só no navegador: http://localhost:5173
npm test           # testes
npm run dist       # gera o instalador em release/
```

## Como usar
- **Piano roll**: clique para criar nota (arraste para esticar), arraste para mover, puxe a borda
  direita para mudar a duração, botão direito apaga, Shift+arrastar seleciona, Ctrl+roda dá zoom.
- **Faixas**: escolha o instrumento, volume, M (mudo) e S (solo). "+ Faixa" adiciona.
- **Timbre**: painel à direita (envelope, filtro, oscilador etc.).
- **Atalhos**: Espaço toca/para · Ctrl+Z / Ctrl+Y desfaz/refaz · Ctrl+S salva · Ctrl+O abre ·
  Ctrl+A seleciona todas as notas · Delete apaga as selecionadas.

Créditos dos samples: `public/samples/CREDITS.md` (CC-BY 3.0).
Documentação técnica: `CLAUDE.md` e `docs/`.
