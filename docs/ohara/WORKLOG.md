# Ohara — Worklog

Registro contínuo do trabalho (decisões + mudanças), mais recente no topo. **Atualizar a cada
sessão/troca de informação.** Fatos verificados são marcados; suposições não entram como fato.

## 2026-08-22

- **Home do portfólio redesenhada** ✅ — layout limpo estilo benscott.dev no **branding JP** (midnight `#0B0F1A` + azul `#2563EB` + laranja `#F97316` + sage): hero (nome + mote + role + socials), **cards de preview** (Ohara em destaque, Kafka Viz, Angular Demo) com 'Ver ao vivo' — o app só carrega ao entrar (não iframe na home, como o JP apontou). Stack + footer. Removido o clutter espacial (starfield sutil). Build do web verde. Deploy: Source já em 'GitHub Actions' → merge no `main` + push.

- **Deploy quebrou e corrigido** — CI (`yarn install --frozen-lockfile`, Node 20) abortava: `@testing-library/jest-dom@6.10.0` exige Node >=22. Fixado em **`~6.4.0` → 6.4.8** (Node 20 ok), lockfile regenerado, 9 testes verdes. `.nojekyll` adicionado ao artefato. **Diagnóstico do Pages:** home servindo README via Jekyll + `/apps/ohara/front` em branco (index de fonte apontando p/ `/src/main.tsx`) → **fonte do Pages provavelmente em 'Deploy from a branch'**; precisa virar **'GitHub Actions'** (config do repo). Layout do portfólio a redesenhar (ref: benscott.dev + branding JP).

- **Home do Ohara + no portfólio** ✅ — app ganhou **home (seletor de trilha)** → 'Arquitetura de Software' ativa → tela da trilha (26 nós) → voltar. O portfólio (`web/`) passa a **embutir o app Ohara real** (`apps/ohara/front` via `configApps.ohara`); removido o 'em construção'/tech-stack antigo. `packages/config` ganhou `ohara`. build (config→web+front) + 9 testes verdes. **Falta só merge da branch no `main`** p/ ir ao ar (auto-deploy do Pages).

- **Ideia parkada (JP): concept reels** no modal — animação muda em loop mostrando a obra num exemplo real (arq. hexagonal → dataflow; Kafka → logs→offset→…). Registrada em `BACKLOG.md`. Insight-chave: **animar por conceito** (templates paramétricos, ~20-30) e não por livro — é o 'catálogo de tipos'. Fica **depois da v1** (feature funcional + bonita).

- **Camada de explicadores (beginners)** ✅ — schema `explainers[]` (rampa secundária, NÃO nó do DAG); 6 nós difíceis curados com rampas **reais verificadas** (Raft viz, CAP ilustrado, Distributed Systems for Fun and Profit, palestra Paxos/Ongaro) + 1 retail (System Design Interview). Modal ganhou 'Entenda antes'; nó ganha 🌱. Regra ADR-0008 mantida (ordem cega à comissão; explicador aditivo). **Paleta calibrada** (marrom mais leve, dia mais creme) via `tokens.css` — feedback visual do JP. build+test verdes (8 testes).

- **Trilha expandida p/ 26 nós** (Turing/von Neumann → Ford/Newman), **13 fontes livres verificadas** (hosts oficiais: Lamport, MIT CSAIL, ETH, MIT, USENIX, Google) + 33 arestas cronológicas. Raízes: turing/codd/brooks/lamport. Teste virou **contrato** (toda fonte livre tem URL http). **Tokens extraídos** p/ `tokens.css` (identidade escopada, trocável). build+test verdes (7 testes). Seed sincronizado com `web/src/data/ohara`.

- **Front evoluído p/ DAG interativo** ✅ — `graph.ts` faz **layout em camadas** (Kahn + longest-path; **quebra ciclo por cronologia** → zero sobreposição por construção). `TrailCanvas` (nós posicionados + arestas SVG), `TrailNode` (checkpoint Ohara), `NodeModal` (conexões pré-req×descendente + fontes/CTA), tudo com **framer-motion** (hover hop/aura, modal spring). **External config** (`config.ts`+`loadTrail()`: estático→API vira config). **6 testes verdes** (graph 5 + App render). Falta: **polimento visual** (olho do JP via `yarn dev`), capas reais, prévia PDF, e **completar o dado** (13 nós → todas as fontes primárias).

- **Deploy de app aninhado corrigido** ✅ — `scripts/compose-pages.sh` (fonte única) copia `apps/**/dist` (qualquer profundidade, exclui `node_modules`) → `.pages/apps/<path>`; `compose:pages` e `pages.yml` agora chamam o script. Verificado local: `apps/ohara/front` compõe em `.pages/apps/ohara/front/index.html` (deploy → `/apps/ohara/front/`). `clean` atualizado p/ `apps/*/*/dist`. `package-lock.json` removido (yarn-only).

## 2026-08-21

- **Guia de migração** criado — `docs/ohara/MIGRATION-ext4.md` (Node 20 via nvm, clone no ext4,
  node_modules em vez de PnP, build/run). Objetivo: **local espelhar o CI**, sair do NTFS/PnP/Node25.
- Decisão pendente (vira ADR): **node_modules × PnP** — recomendação node_modules.
- JP reforçou: **aliviar contexto via RAG** (docs/memória como fonte de verdade); worklog a cada troca.

- **Migração ext4 EXECUTADA** ✅ — Node 20 (nvm), clone limpo em `~/projetos/portfolio`, `rm .pnp.cjs`; `yarn install` passou (233s) e web/sw-timeline/kafka-viz buildaram. Único erro: `angular-demo` tenta embutir fonte do Google no build (não-fatal). **Repo de trabalho agora é o ext4.**

- **Validação de processo** (JP): identificado que **testes = 0** e falta **gate de qualidade no CI** + **Definition of Done**. Decisão (pendente ok): scaffoldar `apps/ohara/front` **já com** Vitest + `ci.yml` (typecheck/lint/test/verify-sources em PR) + DoD escrita. LLM **não trava** o dev (front/trilha são dado estático; Ollama é modo local, épico posterior).

- **DoR + DoD criados** (`docs/ohara/DOD-DOR.md`), adaptados aos acordos. **SAST no gate**: **CodeQL** já (grátis em repo público) + **Checkmarx** quando houver acesso (familiaridade p/ o trabalho do JP). Reflexão LLM×engenheiro: a melhora da interação vem de **guardrails** (testes/SAST/DoD/RAG), não de modelo mais esperto; cadência = passo menor + explicar (JP aprende fazendo).

- **`apps/ohara/front` scaffoldado** ✅ — Vite+React+TS, renderiza a **trilha verificada** (`seed.distributed-systems.json`) com **Vitest** (3 testes verdes: título · nó conhecido · **5 fontes livres**). `yarn build` (564ms) + `yarn test` passam. Decisões: dado **estático via import** (público = bundle, sem LLM/backend); tokens Ohara **escopados** em `.ohara` (não puxa o `@jpfig/ui` neon); test files fora do `tsc` de build (vitest roda). Workspace **`apps/*/*`** ligado.

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
