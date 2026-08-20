# Roadmap

Documento vivo. Governado pelos [ADRs](../adr/); onde este documento e um ADR divergirem, o ADR
prevalece.

**Contexto de capacidade:** projeto pessoal tocado em paralelo a trabalho em tempo integral.
Sprints de 2 semanas, capacidade realista de 10–15 pontos. Estimativas são relativas, não horas.

---

## SW Timeline

Grafo de genealogia intelectual da engenharia de software. Inverte o modelo de roadmap linear:
em vez de "o que estudar a seguir", responde "de onde isto veio e o que isto gerou".

### Épicos

| # | Épico | Objetivo | ADRs |
|---|---|---|---|
| E1 | Fundação de dados | Schema v2, `timeline-core`, migração, validação em CI | 0003, 0006 |
| E2 | Consolidação do engine | De 5 módulos de render para 1, com orçamento de frame | 0001 |
| E3 | Constelação por busca | Extração de subgrafo, layout em camadas, desambiguação | 0002 |
| E4 | Experiência | Animação de entrada, painel de detalhe, transições, a11y | 0002 |
| E5 | Conteúdo | Crescer o dataset sob as regras de evidência | 0003 |

E1 antes de E2 e E3 deliberadamente: consolidar renderer antes de saber o formato final do dado
significa consolidar duas vezes.

### Sprint 00 — Fundação (bloqueia todo o resto)

| Tarefa | Descrição | Pts |
|---|---|---|
| TASK-001 | Formalizar schema v2 em JSON Schema + tipos TS gerados | 3 |
| TASK-002 | Criar `packages/timeline-core` (subgraph, resolve, validate) | 5 |
| TASK-003 | Elevar `verify-sources.mjs` a regra de CI bloqueante | 2 |
| TASK-004 | Migrar os 14 eventos de `apps/sw-timeline/` para schema v2 | 5 |
| TASK-005 | Corrigir `go-2007` / `go-2009` como nós distintos com `precedes` | 1 |

**Definição de pronto da sprint:** `yarn validate:dataset` falha em dataset inválido; os 14
eventos existem como nós com fonte primária; nenhuma fonte exclusivamente terciária permanece.

Nota de conteúdo: a migração vai expor que vários nós atuais têm apenas Wikipedia como fonte
(`eniac-1945`, `software-crisis-1968`). Sob ADR-0003 isso é inválido. Corrigir a proveniência faz
parte da TASK-004, não é trabalho posterior.

### Sprint 01 — Consolidação do engine

| Tarefa | Descrição | Pts |
|---|---|---|
| TASK-006 | Deletar `renderer.ts` e `three-scene.ts` (990 LOC órfãos) | 1 |
| TASK-007 | Unificar `three-renderer` + `render-three` + `three-scene-optimized` | 8 |
| TASK-008 | Instrumentar frame budget com teste de regressão de performance | 3 |
| TASK-009 | Migrar dataset para `fetch` em runtime, remover `import` estático | 2 |
| TASK-010 | Remover `apps/sw-timeline/` do workspace e do `turbo.json` | 1 |

TASK-007 é a maior dívida técnica do projeto e a de maior risco de estouro.

### Sprint 02 — Constelação por busca

| Tarefa | Descrição | Pts |
|---|---|---|
| TASK-011 | Busca com resolução de entidade e desambiguação | 5 |
| TASK-012 | Layout em camadas temporais (Sugiyama), determinístico | 8 |
| TASK-013 | Render diferenciado por `evidenceGrade` (sólida/tracejada/pontilhada) | 3 |
| TASK-014 | Nó órfão como constelação de um ponto, com marcação explícita | 2 |

TASK-013 é requisito de corretude, não de estética: se o usuário não distingue influência
documentada de inferida na tela, o ADR-0003 não produziu efeito.

### Sprint 03 — Experiência

| Tarefa | Descrição | Pts |
|---|---|---|
| TASK-015 | Animação de entrada em CSS/SVG, sem dependência de WebGL | 5 |
| TASK-016 | Handoff animação → cena WebGL com `React.lazy` | 3 |
| TASK-017 | Painel de detalhe: imagens à esquerda, texto + fontes + contraponto à direita | 5 |
| TASK-018 | Navegação por teclado no grafo (a11y) | 5 |
| TASK-019 | i18n PT/EN das strings da timeline | 2 |

TASK-018 é genuinamente difícil e costuma ser cortada em projetos assim. Navegar um grafo por
teclado não tem solução óbvia — a ordem de tabulação precisa seguir a topologia, não a posição na
tela. Fica na sprint por ser onde o rigor aparece.

---

## DOOM64-Go

Doom 64 reescrito em Go, jogável de ponta a ponta no browser via WebAssembly.

**Objetivo declarado:** zerar o jogo. Os milestones abaixo são escada de risco, não redução de
escopo — cada degrau é demoável sozinho, de modo que uma parada em qualquer ponto ainda deixe
artefato íntegro.

**Honestidade sobre estimativas:** M0–M3 são estimáveis. **M4 em diante não são** — dependem de
quanto do comportamento do Doom 64 precisa ser redescoberto sem acesso ao código de referência
(ADR-0005). Qualquer número aqui seria falsa precisão.

### Escada de milestones

| M | Entrega | Demo verificável | Estimável? |
|---|---|---|---|
| **M0** | Toolchain Go/WASM, ponte canvas, blit de framebuffer, CI | Gradiente animado a 60fps com contador de frame | Sim |
| **M1** | `AssetSource`, carga de ROM via file input, IndexedDB, checksum | Navegador de assets: sprites, texturas, paletas | Sim |
| **M2** | Rasterizador 2D, paletas, blit de sprites | Viewer de texturas com paleta correta | Sim |
| **M3** | Geometria de nível, travessia de BSP, paredes texturizadas | Câmera livre (noclip) num mapa real | Sim |
| **M4** | Colisão, física, alturas de piso, portas, elevadores | Andar pelo mapa com colisão correta | Não |
| **M5** | Entidades, máquina de estados, IA, projéteis, dano | Combate funcional contra inimigos | Não |
| **M6** | Áudio: SFX e música sequenciada via Web Audio | Jogo com som | Não |
| **M7** | HUD, itens, chaves, saída de nível, progressão, save/load | **Jogo zerável** | Não |
| **M8** | Iluminação colorida do Doom 64, gamepad, otimização | Paridade visual | Não |

### M0 em detalhe (única sprint com escopo fechado hoje)

| Tarefa | Descrição | Pts |
|---|---|---|
| TASK-101 | `apps/doom64-go/` com build `GOOS=js GOARCH=wasm` no Turborepo | 3 |
| TASK-102 | Ponte JS mínima: `wasm_exec.js`, instanciação, ciclo de vida | 3 |
| TASK-103 | Framebuffer `[]byte` + `js.CopyBytesToJS` + upload de textura WebGL | 5 |
| TASK-104 | Laço de jogo com `requestAnimationFrame` e contador de frame | 2 |
| TASK-105 | Shell React: carregamento, tela de ROM ausente, HUD de debug | 3 |
| TASK-106 | CI: build Go, `go vet`, teste com fixture freedoom | 3 |
| TASK-107 | `.gitignore` + job que falha se ROM/WAD entrar no índice | 2 |
| TASK-108 | `apps/doom64-go/LICENSE` GPLv2 + nota de licença no README raiz | 1 |

**Definição de pronto do M0:** um `<canvas>` renderiza a 60fps sustentados a partir de um
framebuffer escrito em Go, com **zero alocação no laço quente** verificada por `go test -bench`
com `-benchmem` reportando 0 allocs/op.

Esse critério de alocação zero existe desde o M0 e não depois: o GC do Go no wasm é single-thread,
e uma pausa stop-the-world de 5 ms estoura sozinha o orçamento de 16,6 ms (ADR-0004). Retrofitar
alocação zero num engine pronto é reescrita.

---

## Sequenciamento entre os dois projetos

Não são paralelizáveis com uma pessoa. Ordem:

1. **Sprint 00 da Timeline** — fundação de dados. Bloqueia tudo na timeline.
2. **M0 do DOOM64** — escopo fechado, entrega demoável rápida, valida a tese Go/WASM antes de
   qualquer investimento pesado. Se o frame budget não fechar no M0, o ADR-0004 precisa ser
   revisto antes de escrever engine.
3. **Sprints 01–03 da Timeline** — o projeto mais próximo de entregar valor visível.
4. **M1+ do DOOM64** — a maratona.

O M0 vem cedo de propósito: é o experimento mais barato que pode falsificar a decisão mais cara.

---

## NFRs

### Timeline

| Requisito | Alvo | Como é medido |
|---|---|---|
| Frame a 60fps com 60 nós | ≤ 16,6 ms | Teste de regressão (TASK-008) |
| Bundle inicial do portfólio | Sem chunk WebGL | Orçamento no CI |
| Animação de entrada | 1–2 s | Cobre carga do chunk (ADR-0002) |
| Cobertura de fonte primária | 100% dos nós | `validate_dataset` bloqueante |
| Nós sem contraponto | Métrica, não falha | Relatório de CI |

### DOOM64

| Requisito | Alvo |
|---|---|
| Frame total | 16,6 ms (9 raster / 3 sim / 2 blit / 2,6 GC) |
| Alocação no laço quente | 0 allocs/op |
| Binário WASM | ≤ 8 MB cru, ≤ 2 MB Brotli |
| Assets no repositório | Zero bytes proprietários |

---

## Riscos abertos

Agregados dos ADRs. Nenhum foi resolvido; todos foram aceitos conscientemente.

| Origem | Risco | Mitigação |
|---|---|---|
| ADR-0001 | Timeline acoplada ao deploy do portfólio | Dataset via `fetch`, não `import` |
| ADR-0002 | Ego-network esconde nós órfãos | Órfãos renderizáveis + relatório de CI |
| ADR-0003 | Viés na seleção editorial é invisível no schema | Critérios declarados em `docs/process/editorial.md` |
| ADR-0004 | `js/wasm` é o backend Go menos representativo | Núcleo agnóstico de plataforma, build nativo para profiling |
| ADR-0005 | Fronteira formato/implementação é nebulosa | Proveniência documental por commit |
| ADR-0006 | Camada MCP pode ser processo decorativo | Deletar `engineering-kb` se não for usado até a Sprint 03 |
