# 📖 Guia do Código - Rust API

Este documento explica como o código Rust funciona, linha por linha.

## 🏗️ Estrutura do Projeto

```
rust-api/
├── src/
│   └── main.rs          # Todo o código da aplicação
├── Cargo.toml           # Dependências e metadados
├── Dockerfile           # Container para deploy
└── README.md            # Documentação principal
```

## 📝 Explicação do Código (`main.rs`)

### 1. Imports (linhas 1-13)

```rust
use axum::{...};  // Framework web (similar ao Express.js)
use serde::{...}; // Serialização JSON (como JSON.parse/stringify)
use utoipa::{...}; // Geração automática de OpenAPI/Swagger
```

**O que faz:**
- `axum`: Framework web assíncrono (equivalente ao Express.js/Spring Boot)
- `serde`: Converte structs Rust ↔ JSON automaticamente
- `utoipa`: Gera documentação Swagger automaticamente a partir do código

### 2. Structs (linhas 15-43)

```rust
#[derive(Serialize, ToSchema)]
struct HealthResponse {
    status: String,
    version: String,
}
```

**O que faz:**
- `#[derive(Serialize)]`: Permite converter para JSON automaticamente
- `#[derive(ToSchema)]`: Gera schema OpenAPI automaticamente
- `struct`: Define uma estrutura de dados (como uma classe sem métodos)

**Equivalente em TypeScript:**
```typescript
interface HealthResponse {
  status: string;
  version: string;
}
```

### 3. OpenAPI Documentation (linhas 45-73)

```rust
#[derive(OpenApi)]
#[openapi(
    paths(health_check, get_item, create_item),
    components(schemas(...)),
    tags(...)
)]
struct ApiDoc;
```

**O que faz:**
- `#[derive(OpenApi)]`: Macro que gera documentação OpenAPI automaticamente
- `paths`: Lista todos os endpoints da API
- `components`: Define os schemas (tipos) usados
- `tags`: Organiza endpoints em categorias no Swagger

**Resultado:** Swagger UI em `/swagger-ui` com toda a documentação!

### 4. Endpoints (linhas 75-141)

#### Health Check (linhas 75-89)

```rust
async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}
```

**O que faz:**
- `async fn`: Função assíncrona (não bloqueia o servidor)
- `-> Json<HealthResponse>`: Retorna JSON com tipo `HealthResponse`
- `env!("CARGO_PKG_VERSION")`: Macro que pega a versão do `Cargo.toml` em tempo de compilação

**Equivalente em Express.js:**
```javascript
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '0.1.0' });
});
```

#### Get Item (linhas 91-117)

```rust
async fn get_item(Path(id): Path<String>) -> Result<Json<ItemResponse>, StatusCode> {
    if id == "example" {
        Ok(Json(ItemResponse { ... }))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}
```

**O que faz:**
- `Path(id)`: Extrai parâmetro da URL (ex: `/items/123` → `id = "123"`)
- `Result<T, E>`: Tipo que pode ser sucesso (`Ok`) ou erro (`Err`)
- `StatusCode::NOT_FOUND`: Retorna HTTP 404

**Equivalente em Express.js:**
```javascript
app.get('/items/:id', (req, res) => {
  const id = req.params.id;
  if (id === 'example') {
    res.json({ id, name: 'Example Item' });
  } else {
    res.status(404).send();
  }
});
```

#### Create Item (linhas 119-141)

```rust
async fn create_item(Json(payload): Json<CreateItemRequest>) -> Result<Json<ItemResponse>, StatusCode> {
    let item = ItemResponse {
        id: uuid::Uuid::new_v4().to_string(),
        name: payload.name,
        description: payload.description,
        created_at: chrono::Utc::now().to_rfc3339(),
    };
    Ok(Json(item))
}
```

**O que faz:**
- `Json(payload)`: Extrai e deserializa o body JSON automaticamente
- `uuid::Uuid::new_v4()`: Gera UUID v4 (como `crypto.randomUUID()`)
- `chrono::Utc::now()`: Pega timestamp atual (como `new Date()`)

**Equivalente em Express.js:**
```javascript
app.post('/items', (req, res) => {
  const item = {
    id: crypto.randomUUID(),
    name: req.body.name,
    description: req.body.description,
    created_at: new Date().toISOString()
  };
  res.status(201).json(item);
});
```

### 5. Main Function (linhas 143-167)

```rust
#[tokio::main]
async fn main() {
    // 1. Inicializa logging
    tracing_subscriber::fmt()...init();
    
    // 2. Cria router com rotas
    let app = Router::new()
        .merge(SwaggerUi::new("/swagger-ui")...)
        .route("/health", get(health_check))
        .route("/api/v1/items/:id", get(get_item))
        .route("/api/v1/items", post(create_item))
        .layer(CorsLayer::permissive());
    
    // 3. Inicia servidor
    let addr = SocketAddr::from(([0, 0, 0, 0], 8080));
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
```

**O que faz:**
- `#[tokio::main]`: Transforma `main()` em função assíncrona (necessário para `async/await`)
- `Router::new()`: Cria router (como `express.Router()`)
- `.route()`: Registra rotas (como `app.get()`, `app.post()`)
- `.layer(CorsLayer::permissive())`: Habilita CORS (permite requisições de qualquer origem)
- `axum::serve()`: Inicia o servidor HTTP

**Equivalente em Express.js:**
```javascript
const app = express();
app.use(cors());
app.get('/health', healthCheck);
app.get('/items/:id', getItem);
app.post('/items', createItem);
app.listen(8080);
```

## 🔑 Conceitos Importantes do Rust

### 1. Ownership (Propriedade)

Rust não tem garbage collector. Em vez disso, usa um sistema de "ownership":

```rust
let s = String::from("hello");  // s "possui" a string
let s2 = s;                      // s2 agora possui, s não pode mais usar
// println!("{}", s);            // ❌ Erro! s não existe mais
```

**Por que importa:** Previne bugs de memória (use-after-free, double-free) em tempo de compilação.

### 2. Result Type

```rust
Result<T, E>  // Pode ser Ok(T) ou Err(E)
```

**Exemplo:**
```rust
fn divide(a: i32, b: i32) -> Result<i32, String> {
    if b == 0 {
        Err("Division by zero".to_string())
    } else {
        Ok(a / b)
    }
}
```

**Equivalente em TypeScript:**
```typescript
function divide(a: number, b: number): { ok: true; value: number } | { ok: false; error: string } {
  if (b === 0) {
    return { ok: false, error: "Division by zero" };
  }
  return { ok: true, value: a / b };
}
```

### 3. Async/Await

Rust usa `async/await` similar ao JavaScript:

```rust
async fn fetch_data() -> String {
    // Operação assíncrona
    "data".to_string()
}

async fn main() {
    let data = fetch_data().await;  // Espera o resultado
}
```

**Diferença:** Rust não tem "event loop" como Node.js. Usa `tokio` runtime que é mais eficiente.

## 🧪 Como Testar

### 1. Testar com cURL

```bash
# Health check
curl http://localhost:8080/health

# Get item
curl http://localhost:8080/api/v1/items/example

# Create item
curl -X POST http://localhost:8080/api/v1/items \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Item", "description": "My test"}'
```

### 2. Testar com Swagger UI

1. Inicie o servidor: `cargo run`
2. Abra: http://localhost:8080/swagger-ui
3. Clique em qualquer endpoint
4. Clique em "Try it out"
5. Preencha os parâmetros e clique em "Execute"

### 3. Testar com Postman/Insomnia

Importe o OpenAPI spec:
- URL: http://localhost:8080/api-docs/openapi.json
- Postman/Insomnia pode importar automaticamente

## 🚀 Próximos Passos

### Adicionar Banco de Dados

```rust
// Cargo.toml
[dependencies]
sqlx = { version = "0.7", features = ["runtime-tokio-rustls", "postgres"] }

// main.rs
use sqlx::PgPool;

async fn get_item(
    Path(id): Path<String>,
    State(pool): State<PgPool>  // Injetar conexão
) -> Result<Json<ItemResponse>, StatusCode> {
    let item = sqlx::query_as!(
        ItemResponse,
        "SELECT id, name, description, created_at FROM items WHERE id = $1",
        id
    )
    .fetch_optional(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    item.map(Json).ok_or(StatusCode::NOT_FOUND)
}
```

### Adicionar Validação

```rust
use validator::{Validate, ValidationError};

#[derive(Deserialize, Validate)]
struct CreateItemRequest {
    #[validate(length(min = 1, max = 100))]
    name: String,
    
    #[validate(length(max = 500))]
    description: Option<String>,
}

async fn create_item(
    Json(payload): Json<CreateItemRequest>
) -> Result<Json<ItemResponse>, StatusCode> {
    payload.validate()
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    // ...
}
```

## 📚 Recursos para Aprender Rust

1. **Rust Book** (oficial): https://doc.rust-lang.org/book/
2. **Rust by Example**: https://doc.rust-lang.org/rust-by-example/
3. **Axum Tutorial**: https://github.com/tokio-rs/axum/blob/main/examples/README.md
4. **Rustlings** (exercícios): https://github.com/rust-lang/rustlings

## 💡 Dicas

- **Compile antes de rodar**: `cargo check` verifica erros sem compilar tudo
- **Use `cargo clippy`**: Linter que sugere melhorias
- **Use `cargo fmt`**: Formata código automaticamente
- **Leia os erros**: Compilador do Rust tem mensagens muito úteis!

