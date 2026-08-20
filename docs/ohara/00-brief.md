# Ohara — Product & Architecture Brief

> Ponto de partida do projeto. Consolida as decisões tomadas até aqui. Vai virar
> `docs/ohara/00-brief.md` no monorepo (e alimenta os ADRs em `.claude/adr/`).
> Status: **fundação** · Última revisão: 2026-08-19

---

## 1. O que é

**Ohara** é um leitor de **trilhas de leitura** orientadas a **fontes primárias**. Inspirado em
roadmaps de aprendizado como o **roadmap.sh**, porém com o caminho **derivado do grafo de
citações** — a genealogia das ideias, ordenada por dependência intelectual e **auditável** ("este
livro está aqui porque estes o citam"), em vez de curadoria manual por cargo.

O nome é a **Árvore do Conhecimento de Ohara** (One Piece): a biblioteca que guarda a história
que o mundo quis apagar. Casa com a tese do produto — e com a forma dos dados: **o DAG de fontes
é literalmente uma árvore**. Raízes = fundacionais; galhos = o moderno; o leitor **sobe pela
linhagem**.

## 2. Dois modos — a linha que "ir público" impõe

O acervo pessoal (605 livros, muitos com copyright, uso pessoal) **não pode** ser conteúdo de um
app público. Logo, **um código, dois modos**:

| | **Público** (web, com ads/afiliado) | **Local** (máquina do JP) |
|---|---|---|
| Conteúdo | só **fontes livres/públicas** (RFC, papers, JSR, domínio público) + preview Google Books | + o **acervo** (`library.db`) |
| Leitura | fonte livre no modal; comercial → carimbo + compra | leitor completo dos arquivos dele |
| Extras | trilha, gamificação, afiliado | + **audiobook** (piper) + **injeção de definição** |
| Backend | quase estático + embeds externos → **barato/free-tier** | pipeline pesado (OCR/TTS/Ollama) **local** |

Isso resolve, de uma vez, o risco jurídico **e** o custo de hospedagem.

## 3. Núcleo do produto

- **Trilha (DAG)** por tema/**Role**. O **Role** *recorta* o grafo (filtro por `tags[]`); ele não
  define a ordem — a ordem vem das citações. Ramos que **convergem** ("muitos estudos apontam pro
  mesmo lugar").
- **Nó = livro/fonte** com 3 estados: `no acervo` · `fonte livre` · `comercial (fora do acervo)`.
- **Modal** ao clicar: **esquerda = prévia** (scroll, como abrir o arquivo — teaser de ~10% do
  total, máx. 10 páginas; **fonte livre = leitura completa**); **direita = título/autor + resumo +
  referências navegáveis + CTA**. Referência clicável **fecha o modal, centraliza o nó na trilha
  e abre o modal dele** (redirect interno).
- **CTA por `sourceType`**: `no acervo` → **Ler** (leitor local) · `fonte livre` → **ler completo
  no modal** (sem redirect externo) · `comercial` → **preview Google Books + comprar** (afiliado).
- **Injeção de definição** (local): ao ler, resolve o termo contra a obra que o cunhou e injeta a
  definição *verbatim* no pico de densidade terminológica. É o núcleo do "TTS humanizado".
- **Audiobook** (local): piper, medido em **~15× tempo real** (RTF 0,066).
- **Gamificação orientada à ciência**: progresso = **cobertura do DAG** ("leu 4 dos 6 ancestrais");
  o "boss" = a obra-alvo difícil que você escala lendo os ancestrais; conquistas = **marcos
  intelectuais** (leu a fonte no original, rastreou um termo até quem o cunhou, completou uma
  linhagem). **Fora**: streak diário, leaderboard, aversão à perda — farm de engajamento barateia
  uma ferramenta de verdade.

## 4. Estética — Ohara & Elbaf

Referência: a biblioteca-árvore de Ohara + a **Owl Library** de Elbaf. **Regra**: estrutura
**simples** (a trilha vertical do protótipo), **pele quente** por cima — madeira, pergaminho,
folhagem, luz de lâmpada. A **coruja** é o guia/mascote. O tronco/galho pode *evocar* a árvore
sem virar render literal complexo (evitar o exagero cyberpunk que afundou o sw-timeline).

**Tokens propostos** (a alinhar com `packages/ui/tokens.css` — hoje neon, será substituído):

| Token | Claro (dia/pergaminho) | Escuro (biblioteca à noite) | Uso |
|---|---|---|---|
| `--bg` | `#f3e9d6` pergaminho | `#1c130a` casca | fundo |
| `--surface` | `#fffaf0` | `#2a1d10` madeira | cards/modal |
| `--ink` | `#26201a` | `#ece0c8` | texto |
| `--foliage` | `#4f7a4a` | `#6b9e5f` | estado **no acervo** |
| `--amber` | `#d99433` | `#e0a54a` | **comece** / luz (≈ brand `#F97316`) |
| `--brass` | `#b78a2e` | `#c9a24a` | **fonte livre** (armilar/latão) |
| `--link` | `#2563EB` | `#5a8bf5` | links (nó com o brand JP) |

Semânticos separados do accent; o **laranja do brand** sobrevive como `--amber` (continuidade com
o portfólio). Escuro é o modo-vitrine (a biblioteca noturna).

## 5. Modelo de dados (estende `web/src/data/**/schema.json`)

O schema atual já tem `{ nodes, edges }`, e o nó `{ id, type, label, date, sources[], tags[] }`.
Extensões:

```jsonc
// nó
{
  "id": "evans-2003",
  "type": "work",                 // work | person | paper | standard
  "label": "Domain-Driven Design",
  "author": "Eric Evans",
  "date": "2003-01-01",
  "tags": ["ddd", "software-architecture"],   // carreiras filtram por aqui
  "sources": [                    // cada fonte carrega seu tipo → decide o CTA
    { "url": "...", "sourceType": "retail",  "provider": "amazon" },
    { "url": "...", "sourceType": "free",    "note": "acesso aberto" }
  ],
  "ownership": "resolved-at-runtime"   // cruza com library.db no modo LOCAL; sempre "none" no público
}
// aresta: { "from": "gof-1994", "to": "evans-2003", "reason": ["padrões"] }  // reason = por que a poda incluiu (keyword)
```

Procedência das arestas (regra "proibido inventar"): `citada` (verificável) · `curada` (vocab_refs,
vetada por humano) · `inferida` (`[MODELO]`, nunca apresentada como fato).

### O grafo de referências é dado-base PRÉ-POPULADO (não derivado só do acervo)

Ponto crítico (levantado pelo JP): **não dá pra saber o que uma obra referencia só olhando o que
temos.** Um nó pode citar um livro que ninguém possui — e essa aresta *precisa* existir pra montar
o caminho completo e acender o **nó escuro**. Logo, `nodes`+`edges` são **base pré-populada,
independente de posse**; `ownership` é resolvido à parte, em runtime, só no modo local.

**De onde vêm as arestas sem precisar do livro** (bootstrapping):
1. **Seeds curados** — linhagens canônicas semeadas à mão por tema (alta qualidade, baixa cobertura). Ponto de partida.
2. **Bases de citação abertas** — **OpenCitations (COCI)**, **Semantic Scholar**, **Crossref** dão "A cita B" por DOI, de graça. Resolvem as linhagens de *papers* (CS/sistemas distribuídos) sem ter o PDF.
3. **Bibliografias parseadas** das obras que conseguimos acessar (livres), via `generate-node`/`verify-sources`.
4. **Metadados de livro** — **Google Books / OpenLibrary** (ISBN, ano, capa): dão identidade real aos nós que ninguém possui.

## 6. Monetização

- **Afiliado** (Amazon/ML/Estante): **ranking cego à comissão** — a ordem da trilha vem da
  dependência intelectual, nunca de quem paga. Afiliado é overlay de exibição. Disclosure
  obrigatório.
- **Google Books preview-embed**: o *look inside* sancionado pela editora — a versão "apelativa à
  compra" do carimbo de indisponível, e legal.
- **Ads**: no público, fora do fluxo de leitura.

## 7. Decisões (sementes de ADR)

- **ADR-001 — Monorepo**: manter Turborepo + Yarn workspaces; app novo `apps/ohara` (React+TS).
  Apagar `sw-timeline` + tema neon. Adaptar `generate-node`/`verify-sources`.
- **ADR-002 — Público × Local**: um código, dois modos (§2). Acervo nunca no público.
- **ADR-003 — Dev fora do NTFS**: repo em `~/projetos/portfolio` (ext4); NTFS quebra symlink/perm/case.
- **ADR-004 — Design system**: identidade em `packages/ui`; retematizar tokens neon → Ohara (§4).
- **ADR-005 — IA local**: `generate-node` aponta pro **Ollama** (offline), não OpenAI/Anthropic.
- **ADR-006 — Backend dividido**: API leve (trilha, verificador de fontes, proxy Google Books) em
  free-tier; pipeline pesado (OCR/TTS) **só local**.
- **ADR-007 — Grafo de referências pré-populado**: `nodes`+`edges` são base curada + citações
  abertas (OpenCitations/Semantic Scholar/Crossref) + bibliografias parseadas + metadados
  (Google Books/OpenLibrary); `ownership` resolvido em runtime, à parte. O caminho completo **não
  depende de possuir os livros**.

## 8. Arquitetura & deploy

- **Público**: `web/` + `apps/ohara` → `compose:pages` → **GitHub Pages** (iframe). Dados de trilha
  estáticos (JSON) + embeds externos. API leve em `services/bff-api` (free-tier) quando precisar.
- **Local**: mesma UI, modo local ligado; fala com serviços locais (Ollama, `library.db`, piper) —
  `services/rust-api` para o pesado.

## 9. Roadmap imediato

1. **Migrar** o repo pra ext4 (comandos entregues).
2. **Retematizar tokens** pro Ohara (1 arquivo, propaga em tudo — vitória visual).
3. **Apagar** `sw-timeline` + seed neon.
4. **Scaffold `apps/ohara`** com a cara do protótipo (nós, modal, estados, carreira).
5. **Estender o schema** (§5) e migrar o gerador/verificador de fontes.
6. Modo local (acervo/injeção/audiobook) sobre o mesmo app.

## 10. Pendências & próximos docs

- **Nome**: ✅ Ohara.
- **Docs a derivar** (incremental, do código real): Casos de Uso/Histórias, DER/MER, UML
  (classe/sequência), Fluxograma, **OpenAPI gerado do `bff-api`**, README de execução.
- Já existe base: `.claude/adr/`, `.claude/docs/`, `web/docs`, `schema.json` — **mergear**, não recriar.
