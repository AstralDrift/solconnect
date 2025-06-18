FROM rust:1.81.0-slim

# Install system deps UniFFI might need
RUN apt-get update && apt-get install -y \
    libssl-dev clang cmake pkg-config

WORKDIR /usr/src/solconnect

COPY . .

WORKDIR /usr/src/solconnect/mobile/solchat_sdk

# Build the SDK
RUN cargo build -vv 