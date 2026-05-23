# Little Knights — deploy & interact scripts

## Contracts

| Contract                     | Role                                                 |
| ---------------------------- | ---------------------------------------------------- |
| `LittleKnightsStorage`       | House bankroll for bot (single-player) matches       |
| `LittleKnightsEscrowManager` | Game escrow, fees, multiplayer + single-player flows |

Deploy order: **Storage** (temporary manager = deployer) → **Escrow** → `storage.setManager(escrow)`.

## Setup

```bash
cp .env.example .env
# Set DEPLOYER_PRIVATE_KEY for Celo networks
npm install
npm run compile
```

## Deploy

| Network                  | Command                                                      |
| ------------------------ | ------------------------------------------------------------ |
| In-memory VM (ephemeral) | `npm run deploy:local` or `npm run deploy:localOp`           |
| Persistent local node    | `npm run node` (terminal 1), then `npm run deploy:localhost` |
| Celo Sepolia             | `npm run deploy:celoSepolia`                                 |
| Celo Mainnet             | `npm run deploy:celo`                                        |

Addresses are saved to `deployments/<network>.json`.

Local VM deploys `MockStablecoin` when `STABLECOIN_ADDRESS` is unset. Celo uses defaults (cUSD mainnet / USDC Sepolia) or your `STABLECOIN_ADDRESS`.

## Interact

Set `ACTION` (and optional params), then:

```bash
npx hardhat run scripts/interact/storage.ts --network <network>
npx hardhat run scripts/interact/escrow.ts --network <network>
```

### Storage (`ACTION`)

- `balance` — house balance
- `fund` — `AMOUNT` (admin, approve first)
- `withdraw` — `AMOUNT`
- `setManager` — `MANAGER`
- `transferAdmin` — `NEW_ADMIN`

### Escrow (`ACTION`)

- `balance` | `getGame` | `listGames`
- `createMulti` — `GAME_ID`, `BET_AMOUNT` (player approves escrow)
- `joinMulti` — `GAME_ID`
- `createSingle` — `GAME_ID`, `PLAYER1`, `BET_AMOUNT` (admin; player must approve escrow; storage must be funded)
- `resolve` — `GAME_ID`, `WINNER` (`0x0` = draw)
- `cancel` — `GAME_ID` (pending multiplayer)
- `transferAdmin` | `setFeeRecipient`

`GAME_ID` can be a 32-byte hex string or any string (hashed to `bytes32`).

### Example (persistent localhost)

```bash
# Terminal 1
npm run node

# Terminal 2
npm run deploy:localhost
ACTION=fund AMOUNT=1000 npm run interact:storage -- --network localhost
ACTION=createMulti BET_AMOUNT=1 GAME_ID=game-1 npm run interact:escrow -- --network localhost
```

**Note:** `hardhatMainnet` / `hardhatOp` reset on every `hardhat run`. Use `localhost` to keep state between scripts.
