# rust-api container image. Build context: this directory (services/rust-api).
#
#   docker build -t rust-api .
#   docker run --rm -p 8080:8080 rust-api
#
# Rules this file follows:
#   - base images pinned by tag AND digest (the tag is for humans, the digest
#     is what gets pulled). The Rust version matches RUSTUP_TOOLCHAIN in
#     .github/workflows/ci.yml; builder and runtime are the same Debian
#     release (trixie), so the binary links against the same glibc;
#   - dependencies come only from Cargo.lock (--locked), downloaded in their
#     own step and then built offline;
#   - one other download: the Swagger UI zip that utoipa-swagger-ui embeds.
#     Its own stage (swagger-ui) fetches it with scripts/fetch-swagger-ui.sh,
#     which pins the version and checks the SHA-256 (sha256sum -c); the
#     builder gets only the checked file, through SWAGGER_UI_DOWNLOAD_URL
#     (file://), so the crate's build script does not use the network;
#   - no BuildKit-only syntax, so any builder can run it;
#   - runtime image: the binary, the CA bundle and a non-root user. No
#     compiler, no package manager run, no curl.
#
# To update a digest, read it from the registry (anonymous, read-only):
#   repo=library/rust; tag=1.99.0-slim-trixie
#   token="$(curl -fsS "https://auth.docker.io/token?service=registry.docker.io&scope=repository:${repo}:pull" \
#     | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')"
#   curl -fsS -o /dev/null -D - -H "Authorization: Bearer ${token}" \
#     -H 'Accept: application/vnd.oci.image.index.v1+json' \
#     "https://registry-1.docker.io/v2/${repo}/manifests/${tag}" | grep -i '^docker-content-digest'

# ------------------------------------------------------------- swagger-ui ---
# debian:trixie-slim, the same digest as the runtime stage below. Only this
# stage has curl; nothing from it reaches the builder except the checked zip.
FROM debian:trixie-slim@sha256:a72b4433de1cf7d6bae0c4cee74d0547f58601a643b3375f070c51600d63b6b2 AS swagger-ui

SHELL ["/bin/bash", "-euo", "pipefail", "-c"]

# curl and the CA bundle from Debian's signed repository (apt checks every
# package against the signed index). The zip itself is checked by hash below.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

RUN dpkg-query --show --showformat='${Package} ${Version}\n' ca-certificates curl

WORKDIR /swagger-ui

COPY scripts/fetch-swagger-ui.sh ./fetch-swagger-ui.sh

# Downloads the pinned Swagger UI release and fails unless its SHA-256 matches.
RUN bash fetch-swagger-ui.sh /swagger-ui

# ---------------------------------------------------------------- builder ---
# rust:1.99.0-slim-trixie (multi-arch index, read 2026-11-15)
FROM rust:1.99.0-slim-trixie@sha256:2752b332db73fdbb7dc576f06c82ed1f312005784ef913d7e04a28f5f55dc581 AS builder

SHELL ["/bin/bash", "-euo", "pipefail", "-c"]

ENV CARGO_HOME=/usr/local/cargo \
    CARGO_TERM_COLOR=never \
    CARGO_INCREMENTAL=0

WORKDIR /app

# Print the toolchain and fail early if it is not the one CI uses. A PR that
# changes the rust image tag (e.g. from Dependabot) fails here on purpose
# until it also updates `expected` below and RUSTUP_TOOLCHAIN in
# .github/workflows/ci.yml; scripts/check-rust-toolchain.sh checks the same
# thing in CI before the build.
RUN expected="1.99.0"; \
    rustc --version --verbose; \
    cargo --version; \
    actual="$(rustc --version | cut -d' ' -f2)"; \
    if [ "$actual" != "$expected" ]; then \
      echo "::error title=Rust toolchain mismatch::the rust image has rustc $actual, this Dockerfile expects $expected. A PR that changes the rust image must also set expected=\"$actual\" here and RUSTUP_TOOLCHAIN: \"$actual\" in .github/workflows/ci.yml." >&2; \
      exit 1; \
    fi

# Manifests first: this layer and the download below are reused until
# Cargo.toml or Cargo.lock change.
COPY Cargo.toml Cargo.lock ./

# Download every crate pinned in Cargo.lock (cargo checks each .crate against
# its checksum there). Compiles nothing and runs no build script.
RUN cargo fetch --locked

# The checked Swagger UI zip. utoipa-swagger-ui's build script copies it from
# this file:// URL instead of downloading it.
COPY --from=swagger-ui /swagger-ui/swagger-ui.zip /opt/swagger-ui/swagger-ui.zip

ENV SWAGGER_UI_DOWNLOAD_URL=file:///opt/swagger-ui/swagger-ui.zip

COPY src ./src

# Build from the downloaded crates only: --locked refuses any change to
# Cargo.lock, --offline refuses any network access by cargo.
RUN cargo build --release --locked --offline

RUN sha256sum target/release/rust-api

# ---------------------------------------------------------------- runtime ---
# debian:trixie-slim (multi-arch index, read 2026-11-15; image built 2026-11-04)
FROM debian:trixie-slim@sha256:a72b4433de1cf7d6bae0c4cee74d0547f58601a643b3375f070c51600d63b6b2 AS runtime

SHELL ["/bin/bash", "-euo", "pipefail", "-c"]

# Service user and group with fixed ids, matching USER below.
RUN groupadd --system --gid 10001 rust-api

RUN useradd --system --uid 10001 --gid 10001 --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin rust-api

WORKDIR /app

# CA bundle from the builder (Debian ca-certificates, pinned by the builder
# digest), for outbound TLS. No apt-get here: nothing to pin or clean up.
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt

# Owned by root, so the service user cannot modify its own binary.
COPY --from=builder /app/target/release/rust-api /app/rust-api

USER 10001:10001

EXPOSE 8080

# GET /health over bash's /dev/tcp, so the image needs no curl or wget.
# Render uses healthCheckPath from render.yaml; this one serves docker run,
# compose and the CI smoke test.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["/bin/bash", "-euo", "pipefail", "-c", "exec 3<>/dev/tcp/127.0.0.1/8080 && printf 'GET /health HTTP/1.0\\r\\nHost: localhost\\r\\n\\r\\n' >&3 && grep -q '\"status\":\"ok\"' <&3"]

CMD ["/app/rust-api"]
