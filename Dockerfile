# Multi-stage build for SolConnect

FROM rust:1.81 as builder-rust
WORKDIR /build
COPY Cargo.toml Cargo.lock ./
COPY core ./core
COPY relay ./relay
RUN cargo build --release -p solchat_relay

FROM node:18 as builder-node
WORKDIR /web
COPY SolConnectApp/package.json ./SolConnectApp/
RUN cd SolConnectApp && npm install && npm run build

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder-rust /build/target/release/solchat_relay /usr/local/bin/solchat_relay
COPY --from=builder-node /web/SolConnectApp/.next /app/.next
COPY --from=builder-node /web/SolConnectApp/public /app/public
WORKDIR /app
EXPOSE 8080
CMD ["/usr/local/bin/solchat_relay"]
