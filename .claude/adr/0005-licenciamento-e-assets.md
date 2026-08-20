# ADR-0005 — GPLv2 derivado do linuxdoom; assets nunca versionados

- **Status:** Aceito
- **Data:** 2026-08-07
- **Decisores:** JP Figueredo, Claude (revisão por pares)
- **Aviso:** análise de engenharia sobre licenciamento, não aconselhamento jurídico.

## Contexto

O repositório declara compromisso com software livre (Apache/MIT/GPL). Reescrever Doom 64 exige
decidir, **antes de escrever código**, qual código-fonte pode ser lido — porque ler fonte sob
licença incompatível contamina o resultado de forma que não se desfaz depois.

O terreno é mais acidentado do que aparenta.

### Levantamento das fontes disponíveis

| Fonte | O que é | Situação | Pode ler? |
|---|---|---|---|
| **linuxdoom-1.10** (id Software) | Doom original | **GPLv2**, software livre inequívoco | **Sim** |
| **Doom64EX** (svkaiser) | Reimplementação por RE do Doom 64 | *Doom Source License* original — não-OSI, não-comercial, incompatível com GPLv3 | **Não** |
| **Doom64EX-Plus** (atsb) | Fork modernizado do acima | Herda a mesma licença restritiva | **Não** |
| **DOOM64-RE** (Erick194) | Descompilação do binário N64 | Derivado de binário proprietário | **Não** |
| **Doom 64 (2020)** (Nightdive) | Remaster comercial, Kex Engine | Proprietário fechado | **Não** |
| Documentação pública de formatos | Specs de WAD, BSP, writeups de RE | Texto descritivo | **Sim** |
| **Freedoom** | Assets livres compatíveis com Doom | BSD | **Sim** |

O ponto contraintuitivo: **as fontes mais úteis sobre Doom 64 especificamente são as que não
podem ser lidas.** O Doom64EX é o trabalho de referência sobre o assunto e está sob uma licença
que a comunidade frequentemente descreve como "o código do Doom" sem notar que a liberação GPL da
id em 1999 cobriu o Doom original — não o Doom 64, que é da Midway e nunca teve fonte liberada.

## Decisão

### Regra de higiene de fontes

**Pode ler e derivar:**
- `linuxdoom-1.10` — GPLv2. É a base conceitual legítima (BSP, rasterização, formato WAD).
- Documentação pública de formatos e artigos técnicos de RE, **como texto descritivo**.
- Freedoom, como assets de teste.

**Não pode abrir, nem "só para consultar":**
- Doom64EX, Doom64EX-Plus, DOOM64-RE, qualquer descompilação, qualquer fonte do remaster.

Especificidades do Doom 64 (formato de mapa, layout do ROM, iluminação por vértice) são obtidas
de **descrições em prosa** de trabalhos de RE — não copiando as estruturas de código deles.

### Licença do projeto

**GPLv2**, por derivação do linuxdoom. Não GPLv3: manter a mesma versão da origem elimina uma
classe inteira de discussão de compatibilidade.

Consequência para o monorepo: **DOOM64-Go fica sob GPLv2 enquanto o resto permanece sob a licença
atual** (`LICENSE` na raiz). Licenças por diretório, com `apps/doom64-go/LICENSE` próprio e nota
explícita no README da raiz. Misturar GPLv2 com o restante num único arquivo de licença criaria
ambiguidade sobre o que cobre o quê.

### Assets: nunca no repositório, nunca no artefato

Sprites, texturas, mapas e música do Doom 64 são propriedade da Midway/Nightdive. **Nenhum byte
deles entra em git, build ou deploy.**

Fluxo adotado:

```text
usuário fornece o próprio ROM/IWAD
   → upload local via <input type="file"> (nunca sobe para servidor)
   → validação de checksum (identifica revisão do ROM)
   → persistido em IndexedDB, apenas no browser do usuário
   → engine lê via AssetSource
```

O ROM não trafega em rede. Não há upload para backend — o que também elimina, por construção, a
questão de hospedar material protegido.

Regras de CI:
- `.gitignore` bloqueia `*.z64`, `*.n64`, `*.v64`, `*.wad`, com exceção explícita para freedoom.
- Job de CI falha se um blob acima de 1 MB com assinatura de ROM/WAD entrar no índice.
- Sem ROM carregado, a aplicação mostra tela explicativa — não uma cópia "de demonstração".

## Consequências

**Positivas.** Posição defensável e verificável. O projeto pode ser público no GitHub sem risco de
takedown. Freedoom no CI dá teste de integração real sem tocar em material protegido.

**Negativas.** A restrição mais cara não é jurídica, é de produtividade: **não poder ler o
Doom64EX significa redescobrir por conta própria as especificidades do Doom 64** que alguém já
mapeou. O tempo de desenvolvimento aumenta de forma significativa e não estimável com precisão.

Aceito. É o custo de um projeto de portfólio que aguenta escrutínio — e, dado que o objetivo
declarado inclui aprender Go a fundo, redescobrir tem valor pedagógico que copiar não teria.

**Derivado.** Todo commit que implementa comportamento específico do Doom 64 deve citar, na
mensagem, a fonte documental que o embasou. Isso constrói a trilha de proveniência enquanto a
memória está fresca, em vez de tentar reconstruí-la sob pressão depois.

## Contra-argumento

*Levantado na revisão:*

A distinção entre "ler prosa descritiva sobre o formato" e "ler o código que implementa o
formato" é mais nítida no papel do que na prática. Um artigo de RE que documenta o layout do mapa
do Doom 64 frequentemente **contém trechos de estrutura de dados** — e uma `struct` que descreve
um formato binário tem essencialmente uma forma possível. A fronteira entre fato não-protegível
(o formato) e expressão protegível (a implementação) é genuinamente nebulosa aqui, e a doutrina
de fusão sugere que descrições de formato binário têm proteção fraca — mas "sugere" não é
"garante", e isto não foi validado por um advogado.

Não há mitigação técnica completa. A mitigação adotada é processual: documentar a proveniência de
cada decisão de formato, o que torna auditável de onde cada estrutura veio caso a questão seja
levantada. Registrado como risco aberto, não como problema resolvido.
