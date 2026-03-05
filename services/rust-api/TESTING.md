# 🧪 Guia de Testes - Rust API

## Como Testar a API

### 1. Iniciar o Servidor

```bash
cd services/rust-api
cargo run
```

O servidor iniciará em: `http://localhost:8080`

### 2. Testar Endpoints

#### Health Check
```bash
curl http://localhost:8080/health
```

**Resposta esperada:**
```json
{
  "status": "ok",
  "version": "0.1.0"
}
```

#### Get Item
```bash
curl http://localhost:8080/api/v1/items/example
```

**Resposta esperada:**
```json
{
  "id": "example",
  "name": "Example Item",
  "description": "This is an example item",
  "created_at": "2025-11-07T21:50:00.792Z"
}
```

#### Create Item
```bash
curl -X POST http://localhost:8080/api/v1/items \
  -H "Content-Type: application/json" \
  -d '{"name":"My Item","description":"Test description"}'
```

**Resposta esperada:**
```json
{
  "id": "uuid-gerado-automaticamente",
  "name": "My Item",
  "description": "Test description",
  "created_at": "2025-11-07T21:50:00.792Z"
}
```

### 3. Swagger UI (Interface Gráfica)

Abra no navegador:
```
http://localhost:8080/swagger-ui
```

Você verá:
- ✅ Lista de todos os endpoints
- ✅ Documentação completa
- ✅ Botão "Try it out" para testar cada endpoint
- ✅ Exemplos de request/response

### 4. OpenAPI Spec (JSON)

```bash
curl http://localhost:8080/api-docs/openapi.json | jq .
```

Ou abra no navegador:
```
http://localhost:8080/api-docs/openapi.json
```

## Testando o i18n no Frontend

### 1. Limpar Preferência Salva

No console do navegador (F12):
```javascript
localStorage.removeItem('i18nextLng')
location.reload()
```

### 2. Verificar Idioma Padrão

Após recarregar, o site deve aparecer em **inglês** (padrão).

### 3. Alternar Idioma

- Clique no botão **EN** ou **PT** no header
- O site deve mudar de idioma imediatamente
- A preferência é salva automaticamente

### 4. Verificar Persistência

- Recarregue a página
- O idioma escolhido deve ser mantido

## Verificando o Idioma Atual

No console do navegador:
```javascript
// Ver idioma atual
localStorage.getItem('i18nextLng')

// Mudar para inglês
i18next.changeLanguage('en')

// Mudar para português
i18next.changeLanguage('pt')
```

