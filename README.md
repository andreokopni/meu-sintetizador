# Meu Sintetizador

App desktop gratuito e de código aberto para compor música: faixas numa linha do tempo, notas
num piano roll, instrumentos sintetizados ou por samples, reprodução, partitura e exportação em WAV.

Feito com Electron, React, TypeScript e Tone.js. Interface em português.

## Recursos
- **Multifaixa com piano roll**: cada faixa tem seu instrumento, volume, mudo e solo.
- **Instrumentos**: sintetizadores (subtrativo, FM, bateria) e samples reais (piano, violão,
  violino, flauta, baixo elétrico).
- **Construtor de timbres**: crie seus próprios sons ("Meus timbres") com osciladores, filtro,
  envelopes, LFO, efeitos e macros (Brilho, Ataque, Espaço, Movimento).
- **Partitura**: veja as faixas em notação e exporte em PDF, MusicXML (MuseScore etc.) ou MIDI.
- **Importar partituras** MIDI (`.mid`) e MusicXML (`.musicxml`, `.xml`, `.mxl`).
- **Exportar WAV** (16 bits) e salvar/abrir projetos `.msynth`.
- **Músicas de exemplo** em domínio público (Beethoven, Pachelbel e outras).

## Rodando
Requer [Node.js](https://nodejs.org) 22 ou mais recente.
```
npm install
npm run dev        # abre o app (Electron)
npm run dev:web    # só no navegador: http://localhost:5173
npm test           # testes
npm run build      # checagem de tipos + build
npm run dist       # gera o instalador Windows em release/
```
Se o Electron não abrir após o `npm install`, rode `node node_modules/electron/install.js`.

## Como usar
- **Piano roll**: clique para criar nota (arraste para esticar), arraste para mover, puxe a borda
  direita para mudar a duração, botão direito apaga, Shift+arrastar seleciona. Zoom: Ctrl+roda
  (horizontal), Alt+roda (vertical) ou os botões −/+ no canto. A divisória acima do piano roll
  pode ser arrastada para dar mais espaço a ele.
- **Faixas**: escolha o instrumento, volume, M (mudo) e S (solo). "+ Faixa" adiciona.
- **Timbre**: painel à direita. Instrumentos de fábrica são fixos; use "Personalizar este som"
  para criar uma cópia editável. Para criar do zero, escolha "Construtor (criar timbre)".
- **Atalhos**: Espaço toca/para · Ctrl+Z / Ctrl+Y desfaz/refaz · Ctrl+S salva · Ctrl+O abre ·
  Ctrl+A seleciona todas as notas · Delete apaga as selecionadas.

## Importar partituras
Menu **Abrir ▾ → Importar partitura…** aceita MIDI (`.mid`) e MusicXML (`.musicxml`, `.xml`, `.mxl`).
Onde baixar (verifique a licença de cada obra): MuseScore.com (acervo OpenScore, CC0), IMSLP,
Mutopia Project, Kunst der Fuge. PDF não importa direto: converta antes com o MuseScore
("Importar PDF") ou com o Audiveris.

## Estado do projeto
Em desenvolvimento (versão 0.1). Limitações e bugs conhecidos estão em
[`docs/PENDENCIAS.md`](docs/PENDENCIAS.md). Ideias futuras: samples do usuário, efeitos por faixa,
controlador MIDI e recursos com IA (voz cantada, música por prompt).

## Documentação
- [`CLAUDE.md`](CLAUDE.md) — visão geral da arquitetura e comandos
- [`docs/DECISOES.md`](docs/DECISOES.md) — decisões de arquitetura e o porquê
- [`docs/PENDENCIAS.md`](docs/PENDENCIAS.md) — pendências, ideias e bugs conhecidos
- [`docs/HISTORICO.md`](docs/HISTORICO.md) — o que mudou em cada etapa

## Licença
Código sob a licença [MIT](LICENSE). Os samples em `public/samples` são CC-BY 3.0 de seus
autores — créditos em [`public/samples/CREDITS.md`](public/samples/CREDITS.md). As músicas de
exemplo são arranjos próprios de obras em domínio público.
