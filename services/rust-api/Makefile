.PHONY: help dev build test lint fmt clean run docker-build docker-run

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

dev: ## Run development server with hot reload
	cargo watch -x run

build: ## Build release binary
	cargo build --release

test: ## Run tests
	cargo test --verbose

lint: ## Run clippy linter
	cargo clippy -- -D warnings

fmt: ## Format code
	cargo fmt

check: ## Check code without building
	cargo check

clean: ## Clean build artifacts
	cargo clean

run: ## Run release binary
	./target/release/rust-api

docker-build: ## Build Docker image
	docker build -t rust-api:latest .

docker-run: ## Run Docker container
	docker run -p 8080:8080 rust-api:latest

