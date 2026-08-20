# ADR-0006 — Dois servidores MCP: domínio e processo, com núcleo compartilhado

- **Status:** Aceito
- **Data:** 2026-08-07
- **Decisores:** JP Figueredo, Claude (revisão por pares)

## Contexto

O diretório `.claude/` contém hoje dois arquivos de comando e nada mais. A intenção declarada é
transformá-lo em camada de conhecimento versionada — decisões, sprints e contratos — que sirva a
dois consumidores com necessidades diferentes:

1. **O agente de desenvolvimento**, que precisa recuperar decisões passadas para não recontradizê-las.
2. **O visitante do portfólio**, que precisa ver como o ecossistema funciona.

Sem camada de acesso estruturado, `.claude/` vira o que a maioria dos diretórios de documentação
vira: arquivos que ninguém lê porque ninguém consegue encontrar o relevante no momento relevante.

## A armadilha a evitar

Um servidor MCP que apenas lista e lê arquivos markdown não justifica sua existência — `grep` já
faz isso, melhor e sem processo extra. MCP só se paga quando expõe **operações de domínio que
exigem lógica**, não quando embrulha o sistema de arquivos.

Isso descarta a versão ingênua ("MCP que lê os .md") e força a pergunta certa: que consultas são
caras ou impossíveis de fazer com ferramentas genéricas?

## Decisão

Dois servidores, ambos TypeScript sobre `@modelcontextprotocol/sdk`, transporte stdio, execução
local. Custo de hospedagem zero — compatível com a diretriz de free-tier.

### Servidor 1 — `timeline-dataset` (domínio)

Opera sobre o grafo, não sobre arquivos:

| Ferramenta | Por que não é `grep` |
|---|---|
| `search_nodes(q, limit)` | Resolução de entidade com desambiguação (`"go"` → `go-2007` \| `go-2009`) |
| `get_subgraph(id, da, dd)` | BFS bidirecional sobre o grafo — travessia, não busca textual |
| `validate_dataset()` | Valida schema v2 + regras do ADR-0003 (grau de evidência, fonte primária) |
| `find_orphans()` | Componentes de grau zero — dívida de conteúdo do ADR-0002 |
| `find_unsourced()` | Nós cujas fontes são todas `tertiary` — proibido pelo ADR-0003 |
| `check_cycles()` | Ciclos em relações que devem ser acíclicas (`precedes`, `derives-from`) |

**O ponto arquitetural que justifica tudo:** `get_subgraph` é *a mesma função* que a aplicação usa
para montar a constelação (ADR-0002). Ela não é reimplementada aqui.

```text
packages/timeline-core/          ← lógica de domínio, sem dependência de UI ou de MCP
   ├── subgraph.ts   ← BFS bidirecional
   ├── resolve.ts    ← busca e desambiguação
   └── validate.ts   ← regras do ADR-0003
        ↑                    ↑                      ↑
   web/ (constelação)   .claude/mcp/          CI (validação)
```

Três consumidores, uma implementação. Se a extração de subgrafo mudar, muda em um lugar — e o
servidor MCP passa a ser dogfooding real: as consultas do agente exercitam o mesmo código que
serve o usuário final, o que faz divergência aparecer cedo.

### Servidor 2 — `engineering-kb` (processo)

Opera sobre o grafo de decisões, que também é um grafo:

| Ferramenta | Utilidade |
|---|---|
| `find_decision(topico)` | Qual ADR governa um assunto — evita recontradizer decisão aceita |
| `get_adr(n)` | ADR completo, incluindo o contra-argumento |
| `adr_supersedes(n)` | Cadeia de substituição entre ADRs |
| `list_tasks(sprint, status)` | Estado das sprints a partir do front-matter dos `.md` |
| `open_risks()` | Riscos declarados e não resolvidos, agregados dos ADRs |

`open_risks()` é a ferramenta que mais se paga: hoje há riscos abertos registrados em ADR-0003
(seleção editorial enviesada) e ADR-0005 (fronteira entre formato e implementação). Escritos e
esquecidos, seriam decorativos. Consultáveis, entram na pauta.

### Formato das tarefas

Um `.md` por tarefa, com front-matter YAML — é o que torna as sprints consultáveis em vez de
prosa solta:

```yaml
---
id: TASK-004
sprint: 01
epic: dados
title: Migrar 14 eventos para schema v2
status: todo          # todo | doing | review | done | blocked
estimate: 5           # pontos
adr: [0003]           # ADRs que governam esta tarefa
blocks: [TASK-007]
---
```

### Página `/ecosystem` — derivada, nunca escrita à mão

Um script de build (`scripts/build-ecosystem.mjs`) lê `.claude/` e emite JSON consumido por uma
rota React em `web/`. Renderiza o índice de ADRs com status, o burndown das sprints, o mapa de
dependências entre tarefas e os riscos abertos.

**Regra:** a página é gerada, nunca editada. Documentação escrita à mão em dois lugares diverge em
semanas — e uma página de ecossistema desatualizada é pior que nenhuma, porque afirma rigor que
não existe. Se o build falhar por front-matter inválido, o deploy quebra: o CI é o que garante
que a página e os documentos não podem divergir.

## Consequências

**Positivas.** `packages/timeline-core` força separação limpa entre domínio e apresentação, que é
boa arquitetura independentemente de MCP existir. As regras do ADR-0003 viram executáveis em vez
de aspiracionais. A página de ecossistema é evidência verificável de processo, não alegação.

**Negativas.** Dois servidores MCP e um pacote novo são superfície de manutenção real, para um
repositório de um desenvolvedor. O risco de abandono é concreto.

**Mitigação:** `timeline-dataset` é construído primeiro e só ganha ferramentas que o CI também
usa — validação, órfãos, ciclos. Assim ele não pode apodrecer sem quebrar o build. `engineering-kb`
é explicitamente secundário e só entra depois de existirem ADRs e sprints suficientes para
justificá-lo, o que não é o caso hoje com 6 ADRs.

## Contra-argumento

*Levantado na revisão:*

A camada MCP tem um beneficiário garantido — o agente — e um hipotético: o visitante do
portfólio. Poucos avaliadores vão inspecionar servidores MCP. Se a motivação real for
demonstração, existe risco de otimizar para a aparência do processo em vez de para o trabalho,
que é exatamente o antipadrão que "documentação corporativa" costuma nomear. Seis ADRs e dois
servidores MCP para dois projetos ainda não construídos é uma proporção que merece desconfiança.

**Resposta parcial, não refutação:** o teste é `packages/timeline-core`. Se o núcleo compartilhado
for usado de verdade pelos três consumidores, a camada MCP se paga em correção — divergência
entre app e validação vira impossível por construção. Se `timeline-core` virar wrapper fino que só
o MCP consome, o contra-argumento estava certo e a camada deve ser removida.

**Critério de revisão explícito:** se ao final da Sprint 03 o `engineering-kb` não tiver sido
consultado em decisão real de desenvolvimento, ele é deletado — não mantido por sunk cost.
