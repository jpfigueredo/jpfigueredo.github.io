# Ohara — Backlog de ideias (parkadas, revisitar depois da v1)

## Concept reels no modal (em vez do preview estático) — ideia do JP (2026-08-22)

Trocar o preview estático à esquerda do modal por uma **animação/vídeo mudo em loop** que mostra,
num **exemplo real**, o que a obra representa. Ex.: livro de arquitetura hexagonal → diagrama com o
pacote de dados percorrendo a arquitetura (happy path); livro de Kafka → agrega logs → transiciona
pra alocação de offset → próximo conceito-chave da obra.

**Desafio central = ESCALA.** Animar cada livro à mão não escala (centenas de nós no futuro).
**Insight:** animar por **CONCEITO**, não por livro — uma **biblioteca de templates paramétricos**
(`hexagonal-dataflow`, `log-aggregation/offset`, `consensus-round`, `sharding/CAP-tradeoff`…). Cada
nó referencia conceitos (`concepts: []`); ~20-30 templates cobrem o grosso do corpus, porque muitos
livros compartilham conceitos. **É o mesmo "catálogo de tipos versionado"** do design do
leitor/audiobook — reaproveitar, não reinventar.

- **Tech:** animação por código (SVG/Canvas + framer-motion/GSAP; ou Rive/Lottie). Tocar só o reel
  do **nó selecionado** (perf — nunca todos ao mesmo tempo).
- **Acessibilidade:** alternativa textual (o resumo) + respeitar `prefers-reduced-motion`.
- **Ponte barata (v1.x):** reaproveitar os **explicadores animados que já curamos** (o Raft viz já
  *é* uma animação) embutidos mudos, antes de templates bespoke.
- **Pipeline generativo (depois):** agente lê os conceitos da obra → escolhe templates + sequência
  → engine renderiza, sob a disciplina de curadoria + verificação (proibido inventar).
- **Schema:** slot `conceptReel` (template+params OU mídia), forward-compatible, quando chegarmos lá.

## Outras parkadas

- **Trilhas de pré-requisito** (trilha-de-trilhas): "entenda distribuídos antes desta".
- **Capas reais** nos nós (extraídas do arquivo local / Google Books).
- **Prévia real de PDF** no modal (fonte livre), via pipeline `pdftoppm`.
- **Modo local — varredura do acervo**: só desktop/mobile, opt-in com consentimento claro (aversão no web).
