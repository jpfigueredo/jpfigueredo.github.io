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

