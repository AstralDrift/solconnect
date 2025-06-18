# --- Stage 1: build web client ---
FROM node:18 AS web-build
WORKDIR /app/SolConnectApp
COPY SolConnectApp/ ./
RUN if [ -f package.json ]; then npm ci && npm run build; fi

# --- Stage 2: build relay server ---
FROM rust:1.81 as relay-build
WORKDIR /usr/src/solconnect
COPY . .
RUN cargo build --release -p solchat_relay

# --- Stage 3: runtime ---
FROM debian:bullseye-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=relay-build /usr/src/solconnect/target/release/solchat_relay /usr/local/bin/solchat_relay
COPY --from=web-build /app/SolConnectApp/out /var/www/solconnect
EXPOSE 4433 8080 80
CMD ["solchat_relay"]
