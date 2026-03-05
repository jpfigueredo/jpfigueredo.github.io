# 🦀 Rust API

> **High-performance REST API** built with Rust, Axum, and OpenAPI/Swagger

## 🎯 Overview

This is a template project for building high-performance REST APIs with Rust. It demonstrates:

- **Axum** - Modern, ergonomic web framework
- **OpenAPI/Swagger** - Auto-generated API documentation
- **Type safety** - Rust's compile-time guarantees
- **Performance** - Zero-cost abstractions and async/await
- **Production-ready** - Docker, health checks, CORS, logging

## 🚀 Quick Start

### Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) 1.75+
- [Cargo](https://doc.rust-lang.org/cargo/) (comes with Rust)

### Development

```bash
# Run the server
cargo run

# Run with hot reload (requires cargo-watch)
cargo install cargo-watch
cargo watch -x run

# Or use Makefile (easier)
make dev

# Run tests
cargo test
# or
make test

# Build for production
cargo build --release
# or
make build
```

The API will be available at:
- **API**: http://localhost:8080
- **Swagger UI**: http://localhost:8080/swagger-ui
- **OpenAPI Spec**: http://localhost:8080/api-docs/openapi.json

### Using Makefile

```bash
make help      # Show all available commands
make dev       # Run with hot reload
make build     # Build release binary
make test      # Run tests
make lint      # Run clippy linter
make fmt       # Format code
make clean     # Clean build artifacts
```

## 📚 API Endpoints

### Health Check
```bash
GET /health
```

### Items API
```bash
# Get item by ID
GET /api/v1/items/{id}

# Create new item
POST /api/v1/items
Content-Type: application/json

{
  "name": "My Item",
  "description": "Optional description"
}
```

## 🐳 Docker

```bash
# Build image
docker build -t rust-api .

# Run container
docker run -p 8080:8080 rust-api
```

## 🏗️ Project Structure

```
rust-api/
├── src/
│   └── main.rs          # Main application code
├── Cargo.toml           # Dependencies and metadata
├── Dockerfile           # Container image
├── Makefile             # Convenience commands
├── CODE_GUIDE.md        # Detailed code explanation
└── README.md            # This file
```

## 🛠️ Tech Stack

- **Axum** - Web framework
- **Tokio** - Async runtime
- **Serde** - Serialization/deserialization
- **Utoipa** - OpenAPI/Swagger generation
- **Tracing** - Structured logging

## 📖 Why Rust for APIs?

### ✅ Advantages

- **Performance**: Near C/C++ speed with memory safety
- **Concurrency**: Excellent async/await support
- **Type Safety**: Catch errors at compile time
- **No Runtime**: No garbage collector overhead
- **Ecosystem**: Growing web framework ecosystem

### 🎯 Use Cases

- High-throughput APIs (microservices)
- Real-time systems
- CLI tools
- WebAssembly compilation
- Systems programming
- Embedded systems

## 🔧 Customization

### Adding New Endpoints

1. Define request/response types with `Serialize`/`Deserialize`
2. Add `#[utoipa::path(...)]` macro for OpenAPI docs
3. Register route in `main()`:

```rust
.route("/api/v1/new-endpoint", get(handler_function))
```

### Adding Database

Popular options:
- **SQLx** - Async SQL with compile-time checked queries
- **Diesel** - Type-safe ORM
- **SeaORM** - Modern ORM with async support

### Adding Authentication

- **JWT**: Use `jsonwebtoken` crate
- **OAuth2**: Use `oauth2` crate
- **Session**: Use `tower-sessions` middleware

## 📊 Performance

Rust APIs typically achieve:
- **Latency**: < 1ms for simple endpoints
- **Throughput**: 100k+ requests/second (depends on hardware)
- **Memory**: Low overhead, predictable usage

## 🔗 Resources

- [Rust Book](https://doc.rust-lang.org/book/)
- [Axum Documentation](https://docs.rs/axum)
- [Utoipa (OpenAPI)](https://docs.rs/utoipa)
- [Tokio Tutorial](https://tokio.rs/tokio/tutorial)

## 📄 License

MIT License - see LICENSE file

