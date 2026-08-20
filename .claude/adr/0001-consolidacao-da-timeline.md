# ADR-0001 — Timeline consolidada como rota lazy no `web/`

- **Status:** Aceito
- **Data:** 2026-08-07
- **Decisores:** JP Figueredo, Claude (revisão por pares)
- **Substitui:** a estrutura bifurcada herdada de `1a952e3` e `168f964`

## Contexto

O projeto existe hoje em duas implementações divergentes que não compartilham nem código nem
dados:

| | `apps/sw-timeline/` | `web/src/components/timeline/` |
|---|---|---|
| Visual | eixo linear de anos | constelação (Three.js/WebGL) |
| Dados | `events.ts` — 14 eventos | `seed.json` — 7 nós, 5 arestas |
| Modelo | lista plana, campo `marxistAnalysis` | grafo com arestas tipadas |
| LOC | ~470 | ~3.750 |

As duas metades do produto correto estão em lados opostos: **o visual pretendido está no `web/`,
o conteúdo pretendido está no `apps/`**, e o modelo de dados do `apps/` (lista plana) é incapaz
de expressar a relação entre eventos, que é a proposta central do projeto.

Estado do engine no `web/`: cinco módulos de renderização, dos quais três estão vivos e
sobrepostos (`three-renderer.ts` 486, `render-three.ts` 331, `three-scene-optimized.ts` 720) e
dois são órfãos com zero referências (`renderer.ts` 519, `three-scene.ts` 471).

## Opções consideradas

**A — App standalone em `apps/sw-timeline/`.** Migrar o engine para o app; `web/` vira portal
que linka ou embeda via iframe.

**B — Rota nativa no `web/` com code splitting.** Migrar o *conteúdo* para o dataset de grafo;
deletar `apps/sw-timeline/`.

**C — Manter ambos com papéis distintos.** Teaser leve na home, experiência profunda no app.

## Decisão

**Opção B.** A timeline é uma rota React em `web/`, carregada com `React.lazy` + `import()`
dinâmico. `apps/sw-timeline/` é removido após migração de conteúdo.

### Por que B

1. **Transições suaves são requisito funcional do produto, não polimento.** Com app standalone, a navegação
   portfólio → timeline é *full page load*: perde-se o estado do SPA, a transição e a animação de
   entrada teria de ser duplicada nos dois lados. Isto sozinho elimina A e C.

2. **O "deploy independente" de A é ilusório neste alvo.** GitHub Pages recebe **um único
   artefato** composto por `yarn compose:pages`. App standalone não ganha cadência de release
   própria — ganha só um segundo build Vite e uma segunda cópia da fiação de design system e i18n.

3. **A objeção de bundle levantada contra B se dissolve com code splitting.** O chunk do WebGL
   não entra no bundle inicial do portfólio; carrega sob demanda, *durante* a animação de entrada
   (ver ADR-0002). A tese de que "a animação cobre o carregamento" se sustenta — mas apenas
   condicionada ao splitting, não como propriedade automática da animação. Sem splitting, o custo
   é pago na home do portfólio por todo visitante, inclusive quem nunca abre a timeline.

4. **B é o caminho de menor migração.** Os 3.750 LOC do engine já estão em `web/`. Migra-se
   conteúdo (14 eventos → nós e arestas), não arquitetura.

### Escopo da execução

- Migrar os 14 eventos de `apps/sw-timeline/src/data/events.ts` para o dataset de grafo, no
  schema v2 do ADR-0003.
- Deletar `renderer.ts` e `three-scene.ts` (990 LOC órfãos, confirmado por busca de referências).
- Consolidar `three-renderer.ts` + `render-three.ts` + `three-scene-optimized.ts` em um único
  módulo de renderização.
- Deletar `apps/sw-timeline/` e sua entrada em `package.json#workspaces` e `turbo.json`.
- `apps/angular-demo/` permanece — é vitrine de Angular, não parte da timeline.

## Consequências

**Positivas.** Um renderer, um caminho de dados, um deploy, um design system. Transição SPA
preservada. i18n PT/EN já montado no `web/` passa a valer para a timeline sem duplicação.

**Negativas.** A timeline passa a compartilhar cadência de release com o portfólio: um bug no
portfólio bloqueia deploy da timeline e vice-versa. Aceito — a cadência real deste repositório é
de um desenvolvedor, e o custo de coordenação de dois deployables supera o risco de acoplamento.

**Dívida assumida.** A consolidação dos três renderers vivos é trabalho não trivial e será feita
antes de qualquer feature nova de visualização, não depois. Rastreada como TASK-002.

## Contra-argumento

*Levantado na revisão e não resolvido a favor da decisão:*

Se a timeline crescer para milhares de nós com assets pesados (imagens de logos, retratos,
fac-símiles de papers), o acoplamento ao deploy do portfólio vira gargalo real: cada correção de
conteúdo republica o site inteiro. Neste cenário, A teria sido a escolha certa e a migração de
volta custa caro.

**Mitigação aceita:** o dataset e os assets são carregados via `fetch` em runtime, não importados
no bundle. Corrigir conteúdo passa a ser trocar um JSON no artefato, sem rebuild da aplicação.
Isso preserva a maior parte do benefício de A sem o custo estrutural — mas exige disciplina para
não voltar a fazer `import dataset from './seed.json'`, como o código faz hoje em
`ConstellationTimeline.tsx:3`.
