# ADR-0003 — Fato e interpretação são campos separados, com grau de evidência explícito

- **Status:** Aceito
- **Data:** 2026-08-07
- **Decisores:** JP Figueredo, Claude (revisão por pares)

## Contexto

O requisito declarado é análise **materialista histórica que seja científica e não parcial**. Os
dois modelos de dados existentes hoje falham nisso de maneiras opostas.

`apps/sw-timeline/src/data/events.ts` tem um campo `marxistAnalysis: string` que mistura, no mesmo
blob de texto, coisas de estatutos epistêmicos completamente diferentes. Exemplo real, do nó
`eniac-1945`:

> "A computação nasce sob financiamento militar estatal — o Estado capitalista, pressionado pela
> lógica de guerra, financia a inovação tecnológica que a iniciativa privada não teria assumido
> sozinha."

Há aqui **três** afirmações empilhadas:

1. O ENIAC foi financiado pelo Exército dos EUA — **fato documentado**, verificável, com fonte primária.
2. A iniciativa privada não teria assumido o risco — **contrafactual**, não observável, defensável mas não demonstrável.
3. Isso estabelece um padrão histórico geral de socialização de risco e privatização de lucro — **tese interpretativa**, sustentada por Mazzucato entre outros, e contestada por outros.

Um leitor não consegue distinguir (1) de (3), e a única fonte anexada ao nó é a Wikipedia — que
não sustenta nenhuma das três com o rigor que a afirmação exige.

`web/src/data/sw-timeline/seed.json` tem o problema inverso: modelo de grafo correto, com
`weight` e `evidence` por aresta, mas **nenhum lugar para interpretação**. Ao migrar, o conteúdo
analítico não teria onde morar.

## O problema, dito com precisão

Análise materialista não é o oposto de rigor — ela **é uma afirmação empírica sobre determinação
econômica**, e portanto está sujeita a evidência como qualquer outra. O que a torna acientífica
não é o marco teórico, é apresentá-la como se fosse descrição factual, imune a contestação.

O modelo de dados precisa tornar essa distinção **estrutural**, não uma questão de disciplina do
autor. Se for possível escrever interpretação no campo de fato, alguém vai escrever.

## Decisão

Schema v2, com três separações obrigatórias.

### 1. Fato e interpretação são campos distintos

```jsonc
{
  "id": "go-2007",
  "type": "event",
  "label": "Início do projeto Go na Google",
  "date": "2007-09-01",
  "datePrecision": "month",          // year | month | day — honestidade sobre granularidade
  "summary": "Griesemer, Pike e Thompson iniciam o projeto internamente na Google.",
  "actors": ["robert-griesemer", "rob-pike", "ken-thompson"],
  "sources": [
    { "url": "https://go.dev/talks/2012/splash.article",
      "kind": "primary",             // primary | secondary | tertiary
      "cite": "Pike, R. — Go at Google: Language Design in the Service of Software Engineering" }
  ],
  "analysis": [
    {
      "framework": "historical-materialism",
      "claim": "A linguagem responde a uma contradição concreta da produção de software na escala da Google: o custo de compilação e a complexidade de C++ tornavam-se um limite material à produtividade do trabalho de engenharia.",
      "grade": "supported",           // supported | inferred | contested
      "sources": ["https://go.dev/talks/2012/splash.article"],
      "counterpoint": {
        "claim": "A explicação por 'necessidade de produção' é insuficiente: linguagens concorrentes com propriedades semelhantes existiam e não foram adotadas. A trajetória reflete também autoridade técnica dos autores dentro da organização.",
        "sources": []
      }
    }
  ]
}
```

Regras aplicadas em CI:

- `summary` e `label` **não podem** conter afirmação causal ou avaliativa. São descrição datada.
- Toda entrada em `analysis[]` **exige** `framework` e `grade`.
- `grade: "supported"` **exige** `sources[]` não vazio.
- `grade: "contested"` **exige** `counterpoint` preenchido.
- Nenhum nó pode ter `analysis` sem ter `sources` no nível do fato.

### 2. Arestas carregam grau de evidência, não só peso

O `weight` numérico existente é ambíguo — não distingue "vínculo forte e bem documentado" de
"palpite forte do autor". Substituído por dois campos ortogonais:

```jsonc
{
  "from": "church-1936",
  "to": "turing-1936",
  "relation": "synthesizes",
  "evidenceGrade": "documented",   // documented | inferred | contested
  "strength": 0.8,                 // força do vínculo, ortogonal à qualidade da evidência
  "evidence": [
    { "url": "https://doi.org/10.2307/2269326", "kind": "primary",
      "quote": "Turing, A. M. — Computability and λ-definability (1937)" }
  ]
}
```

- `documented` — o próprio autor cita ou reconhece a influência. Renderizada como linha sólida.
- `inferred` — atribuição de historiador, com fonte secundária. Linha tracejada.
- `contested` — há historiografia divergente. Linha pontilhada + marcação, e o painel de detalhe
  **exibe as duas leituras**.

O grau de evidência é **visualmente distinguível na constelação**. Se o usuário não consegue ver
a diferença entre influência documentada e inferida olhando a tela, o modelo de dados não serviu
para nada.

### 3. Nomenclatura: registro descritivo, não filiação

Toda identificação de escola no código e na interface é substituída por termos **descritivos do
método**, não da filiação política. `marxista` sai; `materialismo histórico` entra no campo
`framework`, e nomes de token/flag passam a descrever **papel**, não conteúdo.

| Antes | Depois | Onde |
|---|---|---|
| `$color-marxist` | `$color-analysis` | `packages/ui/src/tokens.scss` |
| `--ds-marxist` | `--ds-analysis` | `tokens.css`, `web/src/index.css` |
| `swTimelineMarxistAnalysis` | `swTimelineAnalysis` | `packages/config/src/index.ts` |
| `marxistAnalysis: string` | `analysis: Analysis[]` | schema v2 |

Duas justificativas independentes, e a segunda é a que sustenta a decisão:

1. **Retenção.** Um rótulo político no primeiro contato faz o leitor classificar o trabalho antes
   de avaliá-lo — e a classificação, uma vez feita, filtra tudo que vem depois. O conteúdo
   analítico não muda; muda quantas pessoas chegam até ele.

2. **Correção de design system, independente do assunto.** `$color-marxist` já era um token
   defeituoso pelos critérios do próprio projeto: tokens nomeiam **papel semântico**
   (`$color-analysis`, `$color-danger`), nunca o conteúdo que por acaso os ocupa hoje. Um token
   que só serve para um tipo de conteúdo não é token, é constante disfarçada. O mesmo vale para
   `swTimelineMarxistAnalysis`: uma flag deve controlar *o recurso "camada de análise"*, não uma
   escola específica dentro dele.

O ponto que **não** muda: `framework: "historical-materialism"` permanece explícito no dado. A
decisão é sobre registro linguístico na superfície, não sobre ocultar o método — omitir o marco
analítico seria o oposto do que o ADR inteiro defende. O leitor que abrir o painel de detalhe vê
exatamente qual lente produziu aquela leitura, e vê o contraponto ao lado.

### 4. Fontes são tipadas e verificadas

`kind: primary | secondary | tertiary`. O verificador existente em
[scripts/verify-sources.mjs](../../scripts/verify-sources.mjs) já classifica domínios por
"primary-ness" e é a base disto — passa a ser regra de CI, não relatório.

Regra: **nenhum nó pode ter *todas* as fontes `tertiary`.** Wikipedia é ponto de partida de
pesquisa, não sustentação de afirmação. Isso invalida hoje `eniac-1945` e `software-crisis-1968`,
que serão corrigidos na migração.

## Consequências

**Positivas.** A análise vira falsificável: cada afirmação tem marco, grau e fonte, e pode ser
contestada ponto a ponto. O projeto pode sustentar o adjetivo "científico" sem ser dogmático, e a
constelação passa a comunicar incerteza em vez de escondê-la.

**Negativas.** Custo de autoria sobe muito. Cada nó passa de "escrever um parágrafo" para
"localizar fonte primária, classificar, formular contraponto". Isso reduz drasticamente a
velocidade de crescimento do dataset.

**Aceito conscientemente:** 30 nós bem evidenciados valem mais que 300 com fonte de Wikipedia —
para este projeto especificamente, porque o diferencial declarado é rigor, não cobertura. Um
dataset grande e mal-sourced seria indistinguível de conteúdo gerado por LLM, que é exatamente o
que o projeto não quer ser.

**Derivado.** O campo `counterpoint` frequentemente ficará vazio no começo. Vazio é honesto
(ainda não pesquisado); preencher com contraponto fabricado para cumprir tabela seria pior que
deixar vazio. CI reporta cobertura de contraponto como métrica, não como falha.

## Contra-argumento

*Levantado na revisão e parcialmente não resolvido:*

Rotular uma análise com `framework: "historical-materialism"` e anexar um `counterpoint` cria
**aparência de neutralidade sem a substância dela**. A escolha de quais eventos entram no
dataset, quais arestas são desenhadas e quais contrapontos são considerados dignos de registro já
é uma posição teórica — e essa camada de seleção permanece invisível no schema, por mais campos
que se adicione ao nó.

Não há solução técnica para isso. A mitigação é editorial e parcial: `docs/process/editorial.md`
declara explicitamente o marco analítico adotado e os critérios de inclusão, de modo que o viés
seja **declarado em vez de dissimulado**. Um viés declarado continua sendo viés; a diferença é
que o leitor pode descontá-lo.

Registrado aqui porque a decisão foi tomada apesar desta objeção, não por ela ter sido refutada.
