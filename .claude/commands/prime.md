## RUN
eza . --tree --level 4 --git-ignore

## READ
@README.md
@CLAUDE.md
@SolConnectApp/SPEC.md
@SolConnectApp/package.json
@SolConnectApp/src/services/SolConnectSDK.ts
@SolConnectApp/src/services/MessageBus.ts
@SolConnectApp/relay.js
@core/solchat_protocol/Cargo.toml

## Remember
- SolConnect is a decentralized messaging app on Solana
- Use Next.js dev: `cd SolConnectApp && npm run dev`
- Use WebSocket relay: `cd SolConnectApp && npm run relay`
- Use Solana validator: `solana-test-validator --reset`
- Run tests: `cd SolConnectApp && npm test`
- Lint/typecheck: `cd SolConnectApp && npm run lint && npm run typecheck`