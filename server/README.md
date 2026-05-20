# Little Knights Server

TypeScript Node server for chess game state and move validation.

## Stack
- Node.js + Express
- WebSocket (`ws`)
- `chess.js` for rules/state
- Minimax AI for single-player opponent

## Run
```bash
cd server
npm install
npm run dev
```

Build and run production:
```bash
npm run build
npm run start
```

Health endpoint:
- `GET /health` -> `{ "ok": true }`

## Architecture
- `src/index.ts`: app bootstrap, HTTP + WebSocket setup, route registration.
- `src/routes/http/*`: HTTP route wiring.
- `src/routes/ws/*`: WebSocket route wiring.
- `src/handlers/*`: request/message handlers.
- `src/services/*`: game/room services + AI.
- `src/utils/*`: snapshot + socket helpers.
- `src/types/*`: shared server-side types.

## WebSocket Protocol
### Client -> Server
`join`
```json
{
  "type": "join",
  "mode": "single" | "multiplayer",
  "roomId": "string",
  "uid": "string"
}
```

`move`
```json
{
  "type": "move",
  "roomId": "string",
  "uid": "string",
  "from": "e2",
  "to": "e4",
  "promotion": "q"
}
```

### Server -> Client
`joined`
```json
{
  "type": "joined",
  "roomId": "string",
  "mode": "single" | "multiplayer",
  "uid": "string",
  "color": "w" | "b"
}
```

`snapshot`
```json
{
  "type": "snapshot",
  "roomId": "string",
  "mode": "single" | "multiplayer",
  "fen": "FEN string",
  "turn": "w" | "b",
  "isGameOver": false,
  "legalMoves": [{ "from": "e2", "to": "e4", "promotion": "q" }],
  "capturedByWhite": ["p", "n"],
  "capturedByBlack": ["p"]
}
```

`error`
```json
{
  "type": "error",
  "message": "string"
}
```

## What "snapshot" means
A snapshot is the **authoritative current game state** after join/move:
- board position (`fen`)
- whose turn (`turn`)
- currently legal moves (`legalMoves`)
- captured pieces arrays
- game-over status

The frontend does not compute game rules; it renders from snapshot and sends user move intents.

## Room Behavior
- `single`: room created per player (recommended room id: `single-<uid>`). Human is white, backend AI plays black.
- `multiplayer`: room allows two players max (`w` and `b`).

## Notes
- Rooms are in-memory (lost on server restart).
- `uid` is currently client-generated and persisted in localStorage.
