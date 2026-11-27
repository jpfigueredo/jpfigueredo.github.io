# Scripts de Automação

## `verify-sources.mjs` - Verificador de Links

Confere se as fontes livres dos seeds de trilha do Ohara ainda respondem por HTTPS, classifica cada URL
(`primary`, `avoid` ou `unclassified`, pela URL final depois dos redirects) e gera `reports/links.md`
(fora do git), por seed e por nó.

- Lê só `packages/ohara-data/seed.*.json` (formato em `packages/ohara-data/schema.json`). Só as fontes
  com `sourceType: "free"` são verificadas; as outras URLs (fontes `retail`/`preview-embed` e
  explicadores) entram no relatório só como contagem de "não verificadas".
- Não lê `web/src/data/**`: o seed que existia ali tinha links quebrados que deixariam o `--ci` sempre
  vermelho, escondendo uma quebra real no seed do Ohara (o teste garante que o verificador não volte a lê-lo).

Segurança: só `https:` na porta padrão; recusa URL com credencial, host em loopback, rede privada,
link-local, metadados de nuvem, IPv6 que embute IPv4 (compatível, traduzido, Teredo, 6to4, NAT64) e
outros endereços reservados (também depois de um redirect); no máximo 5 redirects, cada um
conferido de novo; timeout por requisição, 4 em paralelo, uma nova tentativa em erro de rede, 429 ou 5xx;
User-Agent genérico, sem token nem cookie. Detalhes e o risco residual (DNS rebinding: fixar o endereço
é obrigatório se o código for reaproveitado com URL vinda de usuário) no cabeçalho do script. Os testes (`verify-sources.test.mjs`) não usam rede: `fetch` e DNS são injetados.

### Uso

```bash
# Verificar links e gerar relatório (sempre sai 0)
yarn verify:links

# Modo CI (sai 1 se algum link estiver quebrado ou for recusado)
yarn ci:verify:links

# Só avisos (::warning), sai 0: é o modo dos pull requests
node scripts/verify-sources.mjs --warn

# Testes, sem rede
node --test scripts/verify-sources.test.mjs
```

No GitHub, `.github/workflows/links.yml` roda em push na `develop`/`main`, toda segunda-feira e à mão
com `--ci`; num PR para a `develop` que mexe num seed ou no verificador, roda com `--warn` e não bloqueia.

---

## `check-seed-copies.mjs` - Guarda contra cópias do seed

Falha se um seed de trilha do Ohara ou o schema dele estiver versionado fora de `packages/ohara-data`.
Lê só o índice do git (`git ls-files -s ':(icase)*.json'`), então arquivo não versionado não conta, e roda fora
do turbo (nenhum cache pula). Um arquivo é dado do Ohara se tem nome `seed*.json` num caminho com
"ohara", se tem a forma de seed (`trail.id` + `nodes[]`) ou se declara o `$id` do schema. Fixtures
legítimas entram no `ALLOWLIST` do script, com motivo; entrada que não bate mais com nada falha.

```bash
node scripts/check-seed-copies.mjs
node --test scripts/check-seed-copies.test.mjs
```


---

## `extract-references.mjs` - Extrator de referências de uma fonte fixada

Lê as páginas Markdown de um repositório aberto, **fixado por SHA** num arquivo de pino
(ex.: `packages/ohara-data/sources/cah.pin.json`), e gera um manifesto JSON determinístico com o que cada
página cita: links classificados (`rfc`, `nist`, `fips`, `attack`, `cisa`, `cve`, `vendor`, `other`) com id
canônico quando existe (`RFC 8446`, `FIPS 197`, `SP 800-38D`, `T1110.001`, `CVE-2024-45678`), revisão e
estágio em campos próprios, título, banner de status, cabeçalhos, linhas da tabela "Claims register" (com os
links de todas as colunas) e os "Next:". Sem dependências e sem rede. A lógica de fence, code span, célula
de tabela e HTML oculto fica em `scripts/lib/markdown-hidden.mjs`.

O conteúdo da fonte e o próprio clone são tratados como não confiáveis: o extrator não clona nem executa
nada do repositório e não roda git dentro do clone nem lê o config dele (lê os objetos por um repo bare
temporário com `alternates`, com ambiente mínimo); confere o HEAD contra o pino e recalcula o SHA-1 do
commit, das trees até `pagesDir` e de cada página; remove conteúdo oculto (comentários HTML, `<?...?>`,
`<!X...>`, CDATA) e caracteres invisíveis e de controle antes de extrair; limita o tamanho por página; só
guarda URLs `http(s)`, depois de decodificar entidades. Detalhes no cabeçalho do script.

### Uso

```bash
# clone raso, num diretório novo, no SHA do pino: só objetos, sem checkout (nada do repositório é
# escrito no worktree nem executado); o HEAD aponta para o SHA sem tocar em arquivos
git init -q /tmp/fonte && git -C /tmp/fonte fetch -q --depth 1 https://github.com/<owner>/<repo>.git <sha>
git -C /tmp/fonte update-ref --no-deref HEAD <sha>

node scripts/extract-references.mjs --pin packages/ohara-data/sources/cah.pin.json --repo /tmp/fonte --out manifesto.json
node scripts/extract-references.mjs ... --only-pinned   # só as páginas listadas no pino
node scripts/extract-references.mjs ... --strict        # sai 1 se o formato do "Claims register" não bater
node scripts/extract-references.mjs ... --run-info run.json --executor <rótulo>  # quem/quando, fora do manifesto
node scripts/extract-references.mjs --diff a.json b.json  # páginas +/-, blob, banner, links e registro +/-
```

Saída: 0 ok; 1 clone diferente do pino (ou `--strict` com registro malformado); 2 uso, I/O ou git.
Testes: `node --test scripts/extract-references.test.mjs`.
