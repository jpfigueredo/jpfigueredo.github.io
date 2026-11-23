# Scripts de Automação

## `generate-node.mjs` - Gerador de Nodes Assistido por IA

Script para gerar nodes do dataset SW Timeline usando IA (OpenAI ou Anthropic).

### Pré-requisitos

Configure uma API key:

```bash
export OPENAI_API_KEY="sk-..."           # Para OpenAI
# ou
export ANTHROPIC_API_KEY="sk-ant-..."    # Para Anthropic
```

### Uso

#### Gerar node a partir de um prompt:

```bash
# Com OpenAI (padrão)
yarn generate:node --prompt "Smalltalk programming language 1972"

# Com Anthropic
yarn generate:node --prompt "Smalltalk programming language 1972" --provider anthropic

# Especificar tipo
yarn generate:node --prompt "Alan Kay" --type person

# Dry run (não adiciona ao dataset)
yarn generate:node --prompt "Smalltalk 1972" --dry-run

# Incluir edges sugeridas automaticamente
yarn generate:node --prompt "Smalltalk 1972" --add-edges
```

#### Gerar node a partir de uma URL:

```bash
yarn generate:node --url "https://doi.org/10.1145/321239.321240" --type work
```

### Exemplos

```bash
# Adicionar trabalho acadêmico
yarn generate:node --prompt "Lambda Calculus paper by Alonzo Church 1936" --type work

# Adicionar pessoa
yarn generate:node --prompt "Alan Kay, inventor of Smalltalk" --type person

# Adicionar tecnologia
yarn generate:node --prompt "Rust programming language, first stable release 2015" --type technology

# Adicionar evento
yarn generate:node --prompt "Dartmouth AI Workshop 1956" --type event

# Gerar e adicionar edges sugeridas
yarn generate:node --prompt "Lisp programming language 1958" --add-edges
```

### Opções

- `--prompt <text>`: Descrição do node a ser gerado
- `--url <url>`: URL de fonte primária para extrair informações
- `--type <type>`: Tipo do node (`person`, `work`, `paradigm`, `event`, `technology`)
- `--provider <provider>`: Provedor de IA (`openai` ou `anthropic`, padrão: `openai`)
- `--dry-run`: Mostra o node gerado sem adicionar ao dataset
- `--add-edges`: Adiciona automaticamente edges sugeridas com base em tags e proximidade temporal

### Output

O script:
1. Gera um node com estrutura JSON válida
2. Sugere edges para nodes existentes com tags similares ou datas próximas
3. Valida que o ID é único
4. Adiciona ao dataset (a menos que `--dry-run` seja usado)

### Validação

O node gerado é validado contra `web/src/data/sw-timeline/schema.json`. Campos obrigatórios:
- `id`: identificador único em kebab-case
- `type`: um dos tipos permitidos
- `label`: rótulo curto e claro
- `date`: data em formato ISO-8601 (YYYY-MM-DD ou YYYY-01-01)

---

## `verify-sources.mjs` - Verificador de Links

Valida URLs de fontes primárias e gera relatório.

### Uso

```bash
# Verificar links e gerar relatório
yarn verify:links

# Modo CI (falha se encontrar links quebrados)
yarn ci:verify:links
```

Veja mais detalhes em `scripts/verify-sources.mjs`.


---

## `extract-references.mjs` - Extrator de referências de uma fonte fixada

Lê as páginas Markdown de um repositório aberto, **fixado por SHA** num arquivo de pino
(ex.: `packages/ohara-data/sources/cah.pin.json`), e gera um manifesto JSON determinístico com o que cada
página cita: links classificados (`rfc`, `nist`, `fips`, `attack`, `cisa`, `vendor`, `other`) com id
canônico quando existe (`RFC 8446`, `FIPS 197`, `SP 800-38D`, `T1110.001`), título, banner de status,
cabeçalhos, linhas da tabela "Claims register" e os "Next:". Sem dependências e sem rede.

O conteúdo da fonte e o próprio clone são tratados como não confiáveis: o extrator não clona nem executa
nada do repositório e não roda git dentro do clone nem lê o config dele (lê os objetos por um repo bare
temporário com `alternates`, com ambiente mínimo); confere o HEAD contra o pino e recalcula o SHA-1 do
commit, das trees até `pagesDir` e de cada página; remove conteúdo oculto (comentários HTML, `<?...?>`,
`<!X...>`, CDATA) e caracteres invisíveis e de controle antes de extrair; limita o tamanho por página; só
guarda URLs `http(s)`, depois de decodificar entidades. Detalhes no cabeçalho do script.

### Uso

```bash
# clone raso, num diretório novo, no SHA do pino (nada do repositório é executado)
git init -q /tmp/fonte && git -C /tmp/fonte fetch -q --depth 1 https://github.com/<owner>/<repo>.git <sha>
git -C /tmp/fonte -c advice.detachedHead=false checkout -q FETCH_HEAD

node scripts/extract-references.mjs --pin packages/ohara-data/sources/cah.pin.json --repo /tmp/fonte --out manifesto.json
node scripts/extract-references.mjs ... --only-pinned   # só as páginas listadas no pino
node scripts/extract-references.mjs ... --strict        # sai 1 se o formato do "Claims register" não bater
node scripts/extract-references.mjs ... --run-info run.json --executor <rótulo>  # quem/quando, fora do manifesto
node scripts/extract-references.mjs --diff a.json b.json  # páginas +/-, blob, banner, links e registro +/-
```

Saída: 0 ok; 1 clone diferente do pino (ou `--strict` com registro malformado); 2 uso, I/O ou git.
Testes: `node --test scripts/extract-references.test.mjs`.
