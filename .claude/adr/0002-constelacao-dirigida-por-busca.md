# ADR-0002 — Constelação é subgrafo extraído por busca, não o grafo inteiro

- **Status:** Aceito
- **Data:** 2026-08-07
- **Decisores:** JP Figueredo (proposta original), Claude (revisão por pares)

## Contexto

A formulação inicial do produto era "uma constelação com toda a história da engenharia de
software". Ao dimensionar o dataset, a premissa se mostrou insustentável: a densidade de eventos
por ano é alta, mas a densidade de *relações causais entre eles* não é. O dataset real é uma
floresta de componentes desconexos, não um grafo conexo.

Isto tem consequência que vai além de estética.

### O problema não é visual, é epistemológico

Um grafo de genealogia intelectual **não é conexo**. A teoria dos tipos de Martin-Löf e o
protocolo TCP não têm ancestral comum próximo; forçá-los na mesma tela produz proximidade
espacial sem relação causal. E proximidade espacial num grafo **é lida como relação** — o leitor
infere conexão onde o dataset não afirma nenhuma.

Renderizar o grafo completo, portanto, não é só ruidoso: **afirma visualmente mais do que as
fontes sustentam.** Para um projeto cujo valor declarado é honestidade intelectual, isso é um
defeito de corretude, não de UX.

### A referência visual adotada resolve o mesmo problema

A tela de habilidades de *The Elder Scrolls V: Skyrim*, adotada como referência de linguagem
visual, faz exatamente o oposto do grafo global: mostra **uma constelação por vez**, internamente
conectada, com navegação explícita entre elas. A escolha estética e a solução epistemológica
convergem para a mesma decisão — o que é um bom sinal, mas a justificativa que prevalece aqui é a
epistemológica.

## Decisão

A unidade de renderização é o **subgrafo de foco**, extraído por consulta:

```text
busca("go") → resolve → nó `go-2007`
            → extrai ego-network bidirecional
            → ancestrais (BFS reversa, profundidade ≤ Da)
            → descendentes (BFS direta, profundidade ≤ Dd)
            → layout → constelação
```

Isto materializa o conceito de **"grande Deque"** que dá origem ao produto: para um ponto
histórico, ver o que veio antes, o que ele é, e o que ele gerou. É a inversão deliberada do
modelo de roadmap linear, que só percorre a direção do futuro.

### Parâmetros

| Parâmetro | Valor inicial | Racional |
|---|---|---|
| Profundidade ancestral `Da` | 3 | Além disso a genealogia dilui e o grafo explode |
| Profundidade descendente `Dd` | 2 | Descendência ramifica mais rápido que ascendência |
| Teto de nós renderizados | 60 | Orçamento de frame; ver `docs/architecture/performance-budget.md` |
| Desempate ao exceder o teto | maior `weight` de aresta | Prioriza vínculos mais bem evidenciados |

Profundidades são controle de usuário, não constante. O teto é rígido.

### Layout

Layout **determinístico**, não force-directed puro: eixo temporal fixo (ancestrais acima/atrás,
descendentes abaixo/à frente) com relaxamento de forças apenas para desempate estético dentro de
cada faixa temporal — estilo Sugiyama em camadas.

Force-directed puro é rejeitado: produz posições diferentes a cada execução, o que quebra memória
espacial entre visitas e torna impossível testar o layout por snapshot.

### Animação de entrada

A animação de construção (referência: abertura do site da FIAP) tem função técnica além de
estética: **é a cobertura de carregamento** do chunk WebGL e do dataset. Orçamento de 1–2s.

Isto obriga uma restrição: a animação de entrada **não pode depender do WebGL**, senão ela
própria fica bloqueada pelo chunk que deveria cobrir. Ela é implementada em CSS/SVG no bundle
inicial, e o handoff para a cena WebGL ocorre quando ambos — animação e chunk — terminam.

## Consequências

**Positivas.** O grafo pode crescer indefinidamente sem degradar o frame budget, porque o custo
de render depende do teto de subgrafo, não do tamanho do dataset. A busca vira a interação
primária, o que é honesto com o caso de uso real ("quero entender X").

**Negativas.** Perde-se a visão panorâmica — não há mais uma tela que "mostra tudo". Aceito: a
visão panorâmica era o artefato desonesto que motivou este ADR. Se for necessária depois, entra
como mapa de densidade por década, sem arestas, deixando claro que não afirma causalidade.

**Requisito derivado.** A busca precisa resolver bem entradas ambíguas. "go" deve desambiguar
entre `go-2007` (início do projeto) e `go-2009` (lançamento público) — ver ADR-0003, que trata
esses como nós distintos ligados por `precedes`. Busca sem desambiguação quebra a proposta.

## Contra-argumento

*Levantado na revisão:*

A extração por ego-network privilegia nós bem conectados e **torna invisíveis os nós órfãos** —
justamente os eventos cuja relação com o resto ainda não foi pesquisada. O sistema passa a
esconder suas próprias lacunas: um evento sem arestas nunca aparece em constelação nenhuma, e a
ausência de pesquisa fica indistinguível da ausência de relação.

Isto é um viés real e não é hipotético — o dataset atual tem 7 nós e 5 arestas, ou seja, já
nasce esparso.

**Mitigação aceita, a implementar junto com a feature:** a busca resolve para qualquer nó,
inclusive de grau zero, e um nó sem arestas é renderizado como constelação de um ponto só, com
marcação visual explícita de "sem vínculos documentados". A validação de CI (ADR-0006) emite
relatório de nós órfãos como dívida de conteúdo rastreável, não como erro silencioso.
