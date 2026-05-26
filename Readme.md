# Little Knights

Little Knights is a mobile-first chess app built around MiniPay + Celo.
Players start a single-player match by staking USDC on-chain, then play a timed game against a backend chess engine over WebSocket.

## What This Project Includes

- `frontend/`: React Router app (mobile UI, MiniPay wallet connection, game board).
- `server/`: Express + WebSocket backend (auth, game state, AI moves, Redis room state, Postgres records).
- `smart_contract/`: Hardhat workspace for escrow/storage contracts and deploy/interact scripts.

## Current Product Status

- Single-player mode is functional end-to-end.
- Multiplayer Exist, core game functionality on the way.
- Desktop is intentionally blocked in the frontend UI; app is designed for MiniPay/mobile.

## Tech Stack

- Frontend: React 19, React Router 7, TypeScript, `react-chessboard`, `viem`
- Backend: Node.js, Express, `ws`, `chess.js`, Redis, Postgres, Drizzle
- Contracts: Solidity (`Escrow` + `Storage`), Hardhat 3, OpenZeppelin
- Chain: Celo Sepolia (default in current codepaths)

## Architecture Overview

### Single-player lifecycle

1. Frontend connects wallet (`eth_requestAccounts`) and signs in via `POST /user/signin`.
2. Frontend creates single game on-chain:
   - Approves escrow to spend USDC if needed.
   - Calls `createSingleGame(gameId, player, amount)` on escrow contract.
3. Frontend stores the created game in backend via `POST /game/single`.
4. Frontend opens WebSocket and sends `join` with `roomId` + `uid`.
5. Server validates room/game and sends snapshots.
6. Player sends `move` messages; backend validates with `chess.js`.
7. In single mode, backend computes AI move (minimax depth 3) and updates room.
8. On end (checkmate/draw/timeout), backend resolves on-chain and marks DB game finished.

### Data responsibilities

- Redis: live room state, clocks, current FEN, connected players.
- Postgres: users and game records (`games`, `users`, `transactions` tables).
- Smart contracts: escrowed funds and final payout logic.

## Quick Start (Local Development)

## 1) Prerequisites

- Node.js 20+ (frontend) and Node.js 24-compatible runtime for server Docker image
- Docker + Docker Compose
- A MiniPay-compatible wallet environment for real on-chain flow

## 2) Start backend dependencies and API

```bash
cd server
docker compose -f compose.dev.yaml up --build
```

This starts:

- Postgres on `localhost:5432`
- Server on `localhost:8080`
- Redis (internal to compose)

## 3) Apply database schema

From `server/`:

```bash
docker compose -f compose.dev.yaml exec -T db psql -U postgres -d little_knights < drizzle/0000_optimal_photon.sql
```

## 4) Configure frontend env

Create `frontend/.env`:

```env
VITE_STABLECOIN_CONTRACT_ADDRESS=<USDC token address>
VITE_ESCROW_CONTRACT_ADDRESS=<escrow contract address>
VITE_STABLECOIN_DECIMALS=6
VITE_BET_AMOUNT=0.1
VITE_CELO_RPC_URL=<optional RPC URL>
```

## 5) Run frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:5173`.

## Environment Variables

### Frontend (`frontend/.env`)

| Variable | Required | Purpose |
|---|---|---|
| `VITE_STABLECOIN_CONTRACT_ADDRESS` | Yes | USDC token address used for balance/allowance/approve |
| `VITE_ESCROW_CONTRACT_ADDRESS` | Yes | Escrow manager contract address |
| `VITE_STABLECOIN_DECIMALS` | Yes | Stablecoin decimals (default flow expects `6`) |
| `VITE_BET_AMOUNT` | Yes | Stake amount for single-player game |
| `VITE_CELO_RPC_URL` | Recommended | RPC used by frontend for read + receipt checks |

### Server (`server/.env`)

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string |
| `REDIS_URL` | Yes | Redis connection URL |
| `JWT_SECRET` | Yes | Signs/verifies `lk_auth` cookie token |
| `PKEY` | Yes (for on-chain resolve) | Backend admin private key for contract resolve tx |
| `ESCROW_CONTRACT` | Yes (for on-chain resolve) | Escrow contract address used by backend resolve calls |
| `BOT_WALLET_ADDRESS` | Yes | Bot/house address used in single-player room state |
| `PORT` | Optional | HTTP/WebSocket port (defaults `8080`) |
| `POSTGRES_USER` | Compose usage | Postgres container setup |
| `POSTGRES_PASSWORD` | Compose usage | Postgres container setup |
| `POSTGRES_DB` | Compose usage | Postgres container setup |

### Smart contracts (`smart_contract/.env`)

| Variable | Required | Purpose |
|---|---|---|
| `DEPLOYER_PRIVATE_KEY` | Yes for Celo deploys | Deployment wallet |
| `STABLECOIN_ADDRESS` | Optional | Override default stablecoin per network |
| `FEE_RECIPIENT` | Optional | Protocol fee receiver |
| `CELO_SEPOLIA_RPC_URL` | Optional | Sepolia RPC override |
| `CELO_MAINNET_RPC_URL` | Optional | Mainnet RPC override |

## API Surface

### HTTP

- `GET /health` -> health check
- `POST /user/signin?id=<walletAddress>` -> creates/fetches user, sets auth cookie
- `GET /user?id=<walletAddress>` -> fetch user profile
- `POST /game/single` -> saves single game record (auth required)
- `GET /redis` -> debug/test nonce endpoint

### WebSocket messages

Client -> server:

- `join`: join/create room for single or multiplayer
- `move`: submit move intent
- `new_game`: reset game state for existing room (used in multiplayer flow)

Server -> client:

- `joined`: assigned color
- `snapshot`: authoritative board state + legal moves + clocks + captures
- `game_end`: winner + reason
- `error`: validation/protocol error message

## Single-Game Transaction Flow (MiniPay Fee Token Detection)

Frontend single-game transaction code is in:

- `frontend/app/utils/contract-calls/singleGame.ts`

Current behavior:

- Uses `eth_sendTransaction` for `approve` and `createSingleGame`.
- Sends `from`, `to`, and encoded `data`.
- Intentionally leaves `feeCurrency` unset so MiniPay can auto-select available token for network fees.

## Scripts Reference

### Frontend

```bash
npm run dev
npm run build
npm run start
npm run typecheck
```

### Server

```bash
npm run dev
npm run build
npm run start
npm run typecheck
```

### Smart Contracts

```bash
npm run compile
npm run node
npm run deploy:localhost
npm run deploy:celoSepolia
npm run deploy:celo
npm run interact:storage -- --network <network>
npm run interact:escrow -- --network <network>
```

## Deployment Notes

- Production API domain in code: `https://api.chess.gwilldan.xyz`
- Production WS domain in defaults: `wss://api.chess.gwilldan.xyz`
- `server/compose.yaml` is set up for Traefik + external `proxy` network.

## Known Limitations

- Multiplayer UX is not fully shipped yet.
- Room state is kept in Redis; availability depends on Redis persistence/uptime.
- Server CORS allowlist is currently hardcoded in `server/src/index.ts`.

## Troubleshooting

- `Unauthorized` on `/game/single` or WebSocket:
  - Ensure `/user/signin` was called successfully and browser keeps cookies (`credentials: include`).
- `Game is not open on contract.` on join:
  - Ensure `createSingleGame` tx completed and `/game/single` was saved.
- On-chain resolve not happening:
  - Check `PKEY`, `ESCROW_CONTRACT`, chain RPC reachability, and server logs.
- Frontend can’t connect to API locally:
  - Confirm backend is running on `http://localhost:8080`.
