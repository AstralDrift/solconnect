# Multi-stage build for SolConnect

# ----- Build Node.js frontend -----
FROM node:18-bullseye AS frontend
WORKDIR /build/SolConnectApp
COPY SolConnectApp/package*.json ./
RUN if [ -f package.json ]; then npm ci; fi
COPY SolConnectApp .
RUN if [ -f package.json ]; then npm run build; fi

# ----- Build Rust components -----
FROM rust:1.81.0-slim AS backend
RUN apt-get update && apt-get install -y libssl-dev clang cmake pkg-config protobuf-compiler
WORKDIR /build
COPY . .
RUN cargo build --release -p solchat_relay
RUN cargo build --release -p solchat_sdk || true

# ----- Production image -----
FROM debian:bullseye-slim
RUN apt-get update && apt-get install -y libsodium23 && rm -rf /var/lib/apt/lists/*
COPY --from=backend /build/target/release/solchat_relay /usr/local/bin/solchat_relay
COPY --from=frontend /build/SolConnectApp/.next /app/.next
COPY --from=frontend /build/SolConnectApp/public /app/public
WORKDIR /app
ENV NODE_ENV=production
EXPOSE 8080
CMD ["/usr/local/bin/solchat_relay"]
