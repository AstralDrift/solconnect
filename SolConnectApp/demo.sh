#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Starting SolConnect Demo...${NC}"

# Check if solana-test-validator is running
if ! pgrep -x "solana-test-validator" > /dev/null; then
  echo -e "${BLUE}Starting solana-test-validator...${NC}"
  solana-test-validator --reset --quiet &
  VALIDATOR_PID=$!
  sleep 5  # Wait for validator to start
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo -e "${BLUE}Installing dependencies...${NC}"
  npm install
fi

# Run seed script
echo -e "${BLUE}Seeding demo data...${NC}"
node scripts/seed-demo.cjs

# Start relay server
echo -e "${BLUE}Starting relay server...${NC}"
npm run relay &
RELAY_PID=$!

# Start web client
echo -e "${BLUE}Starting web client...${NC}"
npm run dev &
CLIENT_PID=$!

# Wait for client to start
sleep 3

# Open browser
echo -e "${BLUE}Opening browser...${NC}"
open http://localhost:3000

echo -e "${GREEN}✨ Demo is ready!${NC}"
echo -e "${BLUE}Press Ctrl+C to stop all services${NC}"

# Handle cleanup on exit
trap "kill $VALIDATOR_PID $RELAY_PID $CLIENT_PID 2>/dev/null" EXIT

# Keep script running
wait 