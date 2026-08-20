# Ecossistema de Engenharia — `.claude/`

Este diretório **não é configuração de ferramenta**. É a camada de conhecimento versionada do
monorepo: as decisões, o processo e os contratos que governam o que existe em `web/`, `apps/`,
`packages/` e `services/`.

Ele é público e é parte do portfólio. A rota `/ecosystem` no `web/` é gerada a partir daqui —
os documentos são a fonte, a página é derivada. Se a página e o documento divergirem, o
documento está certo.

## Por que isto existe

Um portfólio normalmente mostra o artefato e esconde o raciocínio. O artefato é a parte fácil de
copiar e a parte difícil de avaliar. O que distingue trabalho de engenharia de trabalho de
implementação é o registro de **por que as alternativas foram descartadas** — e isso só é
verificável se estiver escrito no momento da decisão, não reconstruído depois.

Daí a regra central deste diretório:

> Nenhuma decisão arquitetural entra em código antes de existir como ADR.
> Nenhum ADR é aceito sem a seção de contra-argumento preenchida por alguém que discorde.

## Estrutura

```text
.claude/
├── README.md              ← este arquivo (mapa do ecossistema)
├── adr/                   ← Architecture Decision Records, imutáveis após aceite
│   └── NNNN-titulo.md
├── sprints/               ← um .md por tarefa, agrupados por sprint
│   └── sprint-NN/
│       ├── README.md      ← objetivo, capacidade, resultado
│       └── TASK-NNN-*.md  ← uma tarefa, um arquivo
├── docs/
│   ├── architecture/      ← C4, contratos de dados, orçamentos de performance
│   ├── infra/             ← CI/CD, ambientes, custo, runbooks
│   └── process/           ← definição de pronto, política de revisão
├── mcp/                   ← servidores MCP (domínio + processo)
└── commands/              ← slash commands do Claude Code
```

## Estado dos ADRs

| # | Decisão | Status |
|---|---|---|
| [0001](adr/0001-consolidacao-da-timeline.md) | Timeline vira rota lazy no `web/`; `apps/sw-timeline/` é removido | Aceito |
| [0002](adr/0002-constelacao-dirigida-por-busca.md) | Constelação é subgrafo extraído por busca, não o grafo inteiro | Aceito |
| [0003](adr/0003-modelo-de-dados-falsificavel.md) | Fato e interpretação são campos separados, com grau de evidência | Aceito |
| [0004](adr/0004-doom64-go-wasm.md) | DOOM64 em Go/WASM com shell React; engine dedicada, não genérica | Aceito |
| [0005](adr/0005-licenciamento-e-assets.md) | GPLv2 derivado do linuxdoom; assets nunca versionados | Aceito |
| [0006](adr/0006-camada-mcp.md) | Dois servidores MCP: domínio (dataset) e processo (conhecimento) | Aceito |

## Os dois projetos

**SW Timeline** — grafo de genealogia intelectual da engenharia de software. O problema que
resolve: roadmaps ensinam caminho linear para frente; ninguém ensina o caminho para trás, do
conceito avançado até suas fundações. Ver [roadmap](docs/roadmap.md#sw-timeline).

**DOOM64-Go** — Doom 64 jogável de ponta a ponta, reescrito em Go, rodando no browser via
WebAssembly. Ver [roadmap](docs/roadmap.md#doom64-go).

## Princípio editorial

O conteúdo da timeline usa análise materialista histórica. Isso impõe **mais** rigor, não menos:
uma afirmação sobre determinação econômica de um evento técnico é uma afirmação empírica e
precisa de fonte, como qualquer outra. O modelo de dados separa fisicamente o que é fato datado
do que é interpretação, e toda interpretação carrega o marco analítico que a produziu e um
contraponto quando ele existe. Ver [ADR-0003](adr/0003-modelo-de-dados-falsificavel.md).

Análise que não pode ser contestada não é análise, é catequese.
