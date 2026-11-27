.PHONY: help dev build test lint fmt clean run docker-build docker-run

# Cargo commands that compile run through scripts/fetch-swagger-ui.sh: it
# downloads the Swagger UI zip once, checks its SHA-256 and exports
# SWAGGER_UI_DOWNLOAD_URL for utoipa-swagger-ui's build script.
WITH_SWAGGER_UI := bash scripts/fetch-swagger-ui.sh target/swagger-ui

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

dev: ## Run development server with hot reload
	$(WITH_SWAGGER_UI) cargo watch -x run

build: ## Build release binary
	$(WITH_SWAGGER_UI) cargo build --release

test: ## Run tests
	$(WITH_SWAGGER_UI) cargo test --verbose

lint: ## Run clippy linter
	$(WITH_SWAGGER_UI) cargo clippy -- -D warnings

fmt: ## Format code
	cargo fmt

check: ## Check code without building
	$(WITH_SWAGGER_UI) cargo check

clean: ## Clean build artifacts
	cargo clean

run: ## Run release binary
	./target/release/rust-api

docker-build: ## Build Docker image
	docker build -t rust-api:latest .

docker-run: ## Run Docker container
	docker run -p 8080:8080 rust-api:latest

