# ADR-0008 — Monetização e conformidade (Ohara público)

## Status
Aceito — 2026-08-20

## Contexto
O Ohara público terá receita por **anúncios** e **afiliados**. Isso levanta questões legais (LGPD,
disclosure) e de arquitetura (o que é permitido exibir, como rankear).

## Decisão
1. **Afiliados** (Amazon Associados como padrão): o link é o `url` do produto + tag do operador.
   A tag é **config**, obtida uma vez manualmente — nunca gerada por scraping (evita captcha e
   viola ToS). Metadados/preço via **API oficial** (PA-API) ou **Google Books**, nunca raspagem.
2. **Ranking cego à comissão**: a ordem da trilha vem da dependência intelectual (grafo de
   citações). Afiliado é **overlay de exibição** — nunca reordena por quem paga. Inegociável: é o
   que sustenta a credibilidade do produto.
3. **Anúncios**: banners na lateral da tela de leitura / modal. Rede: **AdSense/Ezoic** (ou
   **Carbon** para público dev). *Correção registrada:* **Cloudflare não é rede de anúncios** — é
   CDN/hosting (Cloudflare Pages pode hospedar). Preferir **banner de afiliado segmentado ao livro**
   (Amazon native/product) — mais relevante e rende mais que display genérico.
4. **Preview comercial**: **Google Books Embedded Viewer** (look-inside sancionado pela editora) —
   a versão "apelativa à compra" do carimbo de indisponível. Nunca hospedar páginas de obra protegida.
5. **Conformidade LGPD** (operador no Brasil): banner de **consentimento de cookies** para
   ads/afiliado, **política de privacidade**, e **disclosure de afiliado** visível ("Como Associado
   Amazon, ganho com compras qualificadas"). Respeitar ToS da Google Books API e da rede de anúncios.

## Consequências
- O público fica **barato de hospedar** (estático + embeds externos) e **legalmente limpo** — só
  fontes livres + Google Books + afiliado.
- O acervo pessoal (copyright) permanece no **modo local**, nunca no público (ver `docs/ohara/00-brief.md` §2).
- Cookies de consentimento e disclosure são requisito de release do público, não opcional.
