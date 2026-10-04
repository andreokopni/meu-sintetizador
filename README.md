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
  direita para mudar a duração, botão direito apaga, Shift+arrastar seleciona. Zoom: Ctrl+roda
  (horizontal), Alt+roda (vertical) ou os botões −/+ no canto. A divisória acima do piano roll
  pode ser arrastada para dar mais espaço a ele.
- **Faixas**: escolha o instrumento, volume, M (mudo) e S (solo). "+ Faixa" adiciona.
- **Timbre**: painel à direita (envelope, filtro, oscilador etc.).
- **Atalhos**: Espaço toca/para · Ctrl+Z / Ctrl+Y desfaz/refaz · Ctrl+S salva · Ctrl+O abre ·
  Ctrl+A seleciona todas as notas · Delete apaga as selecionadas.

## Importar partituras
Menu **Abrir ▾ → Importar partitura…** aceita MIDI (`.mid`) e MusicXML (`.musicxml`, `.xml`, `.mxl`).
Onde baixar (verifique a licença de cada obra): MuseScore.com (acervo OpenScore, CC0), IMSLP,
Mutopia Project, Kunst der Fuge. PDF não importa direto: converta antes com o MuseScore
("Importar PDF") ou com o Audiveris.

Créditos dos samples: `public/samples/CREDITS.md` (CC-BY 3.0).
Documentação técnica: `CLAUDE.md` e `docs/`.
