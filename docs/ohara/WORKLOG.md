# Ohara — Worklog

Registro contínuo do trabalho (decisões + mudanças), mais recente no topo. **Atualizar a cada
sessão/troca de informação.** Fatos verificados são marcados; suposições não entram como fato.

## 2026-08-20

- **Identidade visual** do Ohara definida — paleta madeira/pergaminho/folhagem/âmbar/latão, temas
  dia/noite, **escopada ao app** (não toca o `packages/ui` compartilhado, senão a home vira quente).
  O laranja do brand sobrevive como `--amber`; azul `#2563EB` nos links.
- **Validação de infra** (HTTP, hoje): `jpfigueredo.github.io/` = 200; `/apps/sw-timeline/` e
  `/apps/kafka-viz/` = 200; **rust-api** responde (404 em `/` → no ar); **bff-api** sem resposta
  (000 → free-tier do Render dorme). CI (`pages.yml`) usa **Node 20 + `npm install` no angular-demo**
  → **CI está correto; o quebrado é o ambiente local** (NTFS + Node 25 + PnP).
- **Rebrand da home**: "SW Timeline" → **Ohara**, **GOOM64 removido** (nav/card/componente/rota).
  Verificado por build (`web:build` passou). Branch `feat/ohara-rebrand`.
- **Fix `yarn install`**: pacotes internos estavam `1.0.0-beta.1`; `"*"` não casa com prerelease →
  Yarn ia na npm. Corrigido p/ **`0.1.0`**. Lição: **não usar `--amend` em commit já pushado**
  (corrigir com `git push --force-with-lease`).
- **Estrutura**: `apps/ohara/{front,api,bff,service}` (Ohara é projeto, não app único). Glob de
  workspaces vira `apps/*/*`.
- **DOOM64/Go**: p/ navegador é WASM (ou GopherJS, pior). TinyGo reduz tamanho. Engine faz o render;
  ADR-0004/0005 já escolheram portar do linuxdoom. "Do zero" é ambição futura, pós-Ohara.
- **Instituído este WORKLOG** — atualizar a cada troca.

## 2026-08-19

- **Nome definido: Ohara** (Árvore do Conhecimento, One Piece). Estética Ohara + Owl Library (Elbaf).
- **Dois modos, um código**: público (fontes livres + Google Books + afiliado) × local (acervo +
  audiobook + injeção). Acervo pessoal **nunca** no público (copyright).
- **Trilha-carro-chefe verificada** — Sistemas Distribuídos & Arquitetura (13 nós, 5 fontes livres
  com URL que resolve). Linhagem cruzada com listas de referência conhecidas. JSON Schema criado.
- **Docs**: brief (`00-brief.md`) + **ADR-0008** (monetização/LGPD; afiliado estático ok, PA-API
  precisa de backend). Grafo de referências é **base pré-populada** (ADR-0007), não derivado do acervo.
- **Monorepo**: manter Turborepo; **matar `sw-timeline` + tema neon**; migrar dev p/ **ext4**.
- Commits limpos (sem assinatura) dos trabalhos soltos (rename `marxist`→`analysis` + 6 ADRs).

## Antecedentes (design)

- Conceito: **trilhas de leitura sobre fontes primárias** (DAG = árvore do conhecimento); raízes =
  fundacionais, galhos = moderno. **Injeção de definição** entre livros (núcleo). **Audiobook**
  (piper, ~15× tempo real, RTF 0,066 medido). **Gamificação por profundidade** (cobertura do DAG),
  não streak. **Role** recorta o grafo (filtro por tags), a ordem vem das citações.
- Protótipos (artifacts): trilha DAG estilo Duolingo→árvore; modal com prévia (3 págs / fonte livre
  = leitura completa), referências navegáveis, CTA de 3 estados, carimbo de indisponível.
