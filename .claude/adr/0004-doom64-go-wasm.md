# ADR-0004 — DOOM64 em Go/WASM com shell React; engine dedicada, não genérica

- **Status:** Aceito
- **Data:** 2026-08-07
- **Decisores:** JP Figueredo, Claude (revisão por pares)

## Contexto

Objetivo declarado: **Doom 64 jogável de ponta a ponta, possível de zerar**, escrito em Go, no
browser. Estado atual: `apps/doom64-wasm/index.html` é um placeholder de 20 linhas e não existe
uma única linha de Go no repositório.

Duas tensões precisam ser resolvidas antes de qualquer código.

### Tensão 1 — Custo do WASM contra o limite da engine de frontend

O monorepo tem uma diretriz de convergência de stack: TypeScript com React ou Angular em toda a
superfície de aplicação. WASM adiciona um segundo toolchain, um segundo modelo de memória e uma
fronteira de interoperabilidade — custos reais de manutenção que a diretriz existe para evitar.

A questão, portanto, não é qual tecnologia se prefere, mas se o problema cabe dentro do limite da
engine de frontend. Não cabe, e a razão é aritmética:

- Go **não roda em browser** exceto compilado para WebAssembly. Não há segunda via.
- Doom 64 renderiza a 320×240 = **76.800 pixels por frame**. A 60fps são **4,6 milhões de
  pixels/segundo**, cada um resultado de amostragem de textura, cálculo de iluminação e teste de
  profundidade.
- React e Angular são bibliotecas de reconciliação de DOM. Um pixel não é um nó de DOM. Não
  existe formulação do problema em que o diffing de árvore de componentes participe do hot loop
  de um rasterizador.

Resolução aceita: **o WASM fica confinado atrás de um `<canvas>`.** Todo o resto — shell, menus,
HUD, tela de carregamento de ROM, configurações, seletor de nível — é React/TypeScript, no mesmo
`web/` do resto do portfólio. O contrato entre os dois lados é estreito e explícito, e a diretriz
de stack é preservada em toda a superfície exceto no laço quente, onde nenhuma alternativa existe.

### Tensão 2 — engine genérica contra engine dedicada

A hipótese de que uma engine "Doom-compatible" genérica entregaria Doom 64 como caso particular é
atraente porque prometeria reaproveitamento. **A premissa é falsa:** Doom 64 não é um WAD do Doom
rodando numa engine Doom.
É engine própria derivada do código do Doom, com divergências substantivas — formato de mapa
distinto, assets num container ROM de N64 em vez de WAD, iluminação colorida por vértice,
subsistema de áudio do N64. Uma engine Doom 1/2 genérica entregaria Doom 1/2 e **não** entregaria
Doom 64.

Portanto: **dedicada ao Doom 64**, como pedido. Mas com uma inversão que sai de graça.

## Decisão

### Toolchain: Go oficial (`GOOS=js GOARCH=wasm`), não TinyGo

| | Go oficial | TinyGo |
|---|---|---|
| Binário | ~2–8 MB (~1–2 MB br) | ~200–800 KB |
| Goroutines | completas | parciais |
| Reflection / stdlib | completa | incompleta |
| GC | concorrente, mas single-thread no wasm | mais simples |

TinyGo rejeitado apesar do binário menor: as lacunas de goroutine e reflection aparecem tarde, em
subsistemas como áudio e save, e o custo de descobrir isso no meio do M5 é maior que o custo de
banda. O tamanho é mitigado por compressão Brotli e pela mesma técnica de cobertura de
carregamento usada na timeline (ADR-0002).

**Consequência dura: o `js/wasm` do Go é single-threaded.** Goroutines são multiplexadas numa
única thread JS. Isto tem um efeito colateral favorável — **não precisamos de
`SharedArrayBuffer`, logo não precisamos de COOP/COEP, logo GitHub Pages serve**, apesar de não
permitir headers customizados. A isolação cross-origin só volta a ser necessária num tier de
otimização posterior (áudio em AudioWorklet, laço de jogo em Worker), e aí o
`services/edge-proxy` (Cloudflare Worker) já existente injeta os headers.

### Arquitetura de renderização: framebuffer em memória linear, um blit por frame

A regra que governa tudo: **minimizar travessias da fronteira Go↔JS.** Cada chamada `syscall/js`
custa na ordem de centenas de nanossegundos; 76.800 delas por frame é inviável por três ordens de
grandeza.

```text
┌─────────────── WASM (Go) ────────────────┐   ┌──── JS ─────┐
│  game loop → rasterizador                │   │             │
│      ↓ escreve                           │   │             │
│  []byte framebuffer (memória linear)     │   │             │
│      └──── 1× js.CopyBytesToJS/frame ───────→ │  WebGL tex  │→ canvas
└──────────────────────────────────────────┘   └─────────────┘
```

Todo trabalho por pixel acontece dentro do WASM, sobre um `[]byte` pré-alocado. Uma única cópia
em bloco por frame atravessa a fronteira. Upload como textura WebGL, não `putImageData` —
`putImageData` força conversão de formato no lado do browser.

### Orçamento de frame (NFR, medido em CI)

| Etapa | Orçamento |
|---|---|
| Frame total @60fps | **16,6 ms** |
| Rasterização | ≤ 9 ms |
| Simulação de jogo (física, IA) | ≤ 3 ms |
| Blit + upload de textura | ≤ 2 ms |
| Folga para GC | ≤ 2,6 ms |

**Alocação zero no laço quente.** O GC do Go no wasm é single-thread; uma pausa stop-the-world de
5 ms estoura o orçamento sozinha. Todos os buffers pré-alocados no boot, pools para entidades,
`GOGC` ajustado. Isto é a restrição de engenharia mais severa do projeto e precisa ser respeitada
desde o M2, não retrofitada.

### A inversão que sai de graça: WADs livres como fixture de CI

Os assets do Doom 64 são proprietários e **não podem entrar no repositório** (ADR-0005) — o que
significa que o CI não teria com o que testar.

Por isso, a camada de acesso a assets é abstraída atrás de uma interface (`AssetSource`), com duas
implementações: ROM do Doom 64 e WAD clássico. Suporte a WAD **não é objetivo de produto** — é o
que torna possível rodar testes de integração reais no CI usando [freedoom](https://freedoom.github.io/),
que é livre. Efeito colateral, não escopo.

## Consequências

**Positivas.** GitHub Pages viável sem workaround de headers. Stack TypeScript preservado em toda
a superfície de UI. CI com assets livres. A separação `AssetSource` documenta a diferença real
entre Doom e Doom 64 em vez de escondê-la.

**Negativas.** Single-thread significa que rasterização e simulação disputam a mesma thread do
event loop do browser; não há paralelismo até o tier de Worker. O orçamento acima assume isso.

**Risco principal, declarado sem eufemismo.** "Doom 64 jogável de ponta a ponta" é projeto de
milhares de horas — reescrita completa de engine, não port. A escada de milestones em
[roadmap](../docs/roadmap.md#doom64-go) é construída para que **cada degrau seja demoável
sozinho**, de modo que parar no M3 ainda deixe artefatos de portfólio íntegros. Isso é gestão de
risco, não redução de ambição: o objetivo declarado continua sendo zerar o jogo.

## Contra-argumento

*Levantado na revisão:*

Se o objetivo primário é **aprender Go**, o browser é o alvo errado. `js/wasm` é o backend menos
representativo do Go: sem paralelismo real, sem o scheduler que é a característica definidora da
linguagem, `syscall/js` em vez de syscalls de verdade, e ferramentas de profiling degradadas
(`pprof` não funciona igual). Um Doom 64 nativo com Ebiten ou SDL exercitaria goroutines, canais e
o runtime de verdade — e o mesmo código Go poderia ser compilado *também* para wasm depois.

Este argumento é forte e não foi refutado. A decisão pelo browser prevalece por um motivo que não
é técnico: **o alvo é o portfólio**, e um binário nativo que o avaliador precisa baixar e compilar
tem uma fração da taxa de conversão de um link que roda na aba.

Mitigação parcial adotada: o núcleo da engine é escrito **agnóstico de plataforma**, com
`syscall/js` isolado numa camada de porta fina. Isso mantém aberta a compilação nativa para
desenvolvimento e profiling sério — onde as ferramentas de verdade funcionam — com o wasm como
alvo de distribuição.
