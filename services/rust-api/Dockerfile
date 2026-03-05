# Build stage
FROM rust:1.75-slim as builder

WORKDIR /app

# Copy dependency files
COPY Cargo.toml Cargo.lock ./

# Create a dummy src to build dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs

# Build dependencies (cached layer)
RUN cargo build --release && rm -rf src

# Copy source code
COPY src ./src

# Build the application
RUN touch src/main.rs && cargo build --release

# Runtime stage
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/target/release/rust-api /app/rust-api

# Expose port
EXPOSE 8080

# Run the application
CMD ["./rust-api"]

