# Initialize Parallel SolConnect Development

## Variables
FEATURE_NAME: $ARGUMENTS
NUMBER_OF_PARALLEL_WORKTREES: $ARGUMENTS

## Execute these commands
> Execute the loop in parallel with the Bash and Task tool

- create a new dir `dev-trees/`
- for i in NUMBER_OF_PARALLEL_WORKTREES
  - RUN `git worktree add -b FEATURE_NAME-v{i} ./dev-trees/FEATURE_NAME-v{i}`
  - RUN `cp .env.example ./dev-trees/FEATURE_NAME-v{i}/.env` (if exists)
  - RUN `cd ./dev-trees/FEATURE_NAME-v{i}/SolConnectApp && npm install`
  - UPDATE `./dev-trees/FEATURE_NAME-v{i}/SolConnectApp/next.config.js`:
    - Update dev server port to: `3000 + {i}`
  - UPDATE `./dev-trees/FEATURE_NAME-v{i}/SolConnectApp/relay.js`:
    - Update WebSocket port to: `8080 + {i}`
  - RUN `cat ./dev-trees/FEATURE_NAME-v{i}/SolConnectApp/next.config.js` to verify port
  - RUN `cd dev-trees/FEATURE_NAME-v{i} && git ls-files | head -10` to validate
- RUN `git worktree list` to verify all trees created properly

## Notes
- Each parallel workspace will have isolated ports for development
- SolConnect WebSocket relay and Next.js dev server use different ports
- Rust components share the same workspace but isolate builds