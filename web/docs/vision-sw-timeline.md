# SW Timeline – Visão, Escopo e Princípios de UX

## Visão
Representar a evolução da Teoria da Computação e da Engenharia de Software como **constelações temporais**: marcos (nós) interligados por influências, citações e derivações (arestas), navegáveis num céu escuro com eixo vertical do tempo e ligações horizontais entre áreas (ex.: OOP → IA).

## Escopo (MVP)
- Dataset seed (20–30 marcos) com fontes primárias.
- Renderização Canvas 2D de nós/arestas com eixo temporal.
- Interações básicas: pan/zoom, hover/tooltip, foco e trilhas de influência.
- Buscar/filtrar por tema/época/autor em etapa seguinte.

## Princípios de UX
- Minimalista, legível, dark; camadas ativáveis (constelações, overlay Hubble, trilhas).
- Conteúdo comprovável: cada aresta tem evidência/ligação primária.
- Navegação com teleports (deep links) e foco progressivo.

## Entidades e Relações (resumo)
- `node`: { id, type, label, date, authors[], sources[], tags[] }
- `edge`: { from, to, relation, weight?, evidence[] }
- Relações: influences, cites, derives-from, precedes, contradicts, synthesizes.

## Layout
- Y = tempo (escala contínua por ano/data ISO).
- X = clusterização por tema (paradigmas, IA, linguagens) + separação por constelações.
- LOD: reduzir detalhe fora do foco.

## Curadoria
- Somente fontes primárias para **evidenciar** ligações (papers, livros, relatórios originais, anais, DOIs/ISBNs).
- Cada ligação (edge) deve possuir pelo menos um `evidence` com URL, DOI, página/trecho ou citação.

## Entregáveis do MVP
- `schema.json` e `seed.json` validados no CI.
- Renderer Canvas básico com pan/zoom e hover.
- Página `sw-timeline` integrada ao portfólio (fullscreen opcional).


