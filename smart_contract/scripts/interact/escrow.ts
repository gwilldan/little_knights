import "dotenv/config";
import { network } from "hardhat";
import { erc20Abi, isHex, keccak256, parseUnits, toBytes, type Hex } from "viem";
import { loadDeployment } from "../lib/deployments.js";

/**
 * Escrow manager interactions.
 *
 * ACTION env:
 *   balance | getGame | listGames
 *   createMulti | joinMulti | createSingle | resolve | cancel
 *   transferAdmin | setFeeRecipient
 *
 * Examples:
 *   ACTION=balance npx hardhat run scripts/interact/escrow.ts --network hardhatMainnet
 *   ACTION=createMulti GAME_ID=0xabc... BET_AMOUNT=1 npx hardhat run scripts/interact/escrow.ts --network hardhatMainnet
 *   ACTION=joinMulti GAME_ID=0xabc... npx hardhat run scripts/interact/escrow.ts --network hardhatMainnet
 *   ACTION=createSingle GAME_ID=0xabc... PLAYER1=0x... BET_AMOUNT=1 npx hardhat run scripts/interact/escrow.ts --network hardhatMainnet
 *   ACTION=resolve GAME_ID=0xabc... WINNER=0x... npx hardhat run scripts/interact/escrow.ts --network hardhatMainnet
 *   ACTION=resolve GAME_ID=0xabc... WINNER=0x0000000000000000000000000000000000000000 npx hardhat run ...  # draw
 *   ACTION=cancel GAME_ID=0xabc... npx hardhat run scripts/interact/escrow.ts --network hardhatMainnet
 */

const ACTION = process.env.ACTION ?? "balance";
const AMOUNT = process.env.AMOUNT ?? process.env.BET_AMOUNT ?? "1";
const TOKEN_DECIMALS = Number(process.env.TOKEN_DECIMALS ?? "18");

function parseGameId(value: string | undefined): Hex {
  if (!value) {
    return keccak256(toBytes(`lk-game-${Date.now()}`));
  }

  if (isHex(value) && value.length === 66) {
    return value;
  }

  return keccak256(toBytes(value));
}

const connection = await network.connect();
const { viem } = connection;
const publicClient = await viem.getPublicClient();
const wallets = await viem.getWalletClients();
const wallet = wallets[0];
const deployment = loadDeployment(connection.networkName);

const escrow = await viem.getContractAt("LittleKnightsEscrowManager", deployment.escrow);

const amount = parseUnits(AMOUNT, TOKEN_DECIMALS);
const gameId = parseGameId(process.env.GAME_ID);

console.log(`Escrow @ ${deployment.escrow}`);
console.log(`Wallet: ${wallet.account.address}`);
console.log(`Action: ${ACTION}`);

async function approveEscrow(spenderAmount = amount) {
  const approveHash = await wallet.writeContract({
    address: deployment.stablecoin,
    abi: erc20Abi,
    functionName: "approve",
    args: [deployment.escrow, spenderAmount],
    account: wallet.account,
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });
  console.log(`Approved escrow to spend ${AMOUNT} tokens`);
}

switch (ACTION) {
  case "balance": {
    const escrowBal = await escrow.read.getContractBalance();
    const admin = await escrow.read.admin();
    const feeRecipient = await escrow.read.feeRecipient();
    console.log(`Escrow stablecoin balance: ${escrowBal.toString()}`);
    console.log(`Admin: ${admin}`);
    console.log(`Fee recipient: ${feeRecipient}`);
    break;
  }

  case "getGame": {
    const game = await escrow.read.getGame([gameId]);
    console.log("Game:", game);
    break;
  }

  case "listGames": {
    const ids = await escrow.read.getAllGameIds();
    console.log(`Games (${ids.length}):`);
    for (const id of ids) {
      const game = await escrow.read.getGame([id]);
      console.log(`- ${id} | mode=${game.mode} status=${game.status} p1=${game.player1} p2=${game.player2}`);
    }
    break;
  }

  case "createMulti": {
    await approveEscrow();
    const hash = await escrow.write.createMultiGame([gameId, amount], { account: wallet.account });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`Created multiplayer game ${gameId}`);
    break;
  }

  case "joinMulti": {
    await approveEscrow();
    const hash = await escrow.write.joinMultiGame([gameId], { account: wallet.account });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`Joined multiplayer game ${gameId}`);
    break;
  }

  case "createSingle": {
    const player1 = process.env.PLAYER1 as `0x${string}` | undefined;
    if (!player1) {
      throw new Error("PLAYER1 address required (must have approved escrow for BET_AMOUNT)");
    }

    const hash = await escrow.write.createSingleGame([gameId, player1, amount], {
      account: wallet.account,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`Created single-player game ${gameId} for ${player1}`);
    break;
  }

  case "resolve": {
    const winner = (process.env.WINNER ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;
    const hash = await escrow.write.resolveGame([gameId, winner], { account: wallet.account });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`Resolved game ${gameId} winner=${winner}`);
    break;
  }

  case "cancel": {
    const hash = await escrow.write.cancelGame([gameId], { account: wallet.account });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`Cancelled game ${gameId}`);
    break;
  }

  case "transferAdmin": {
    const newAdmin = process.env.NEW_ADMIN as `0x${string}` | undefined;
    if (!newAdmin) {
      throw new Error("NEW_ADMIN address required");
    }
    const hash = await escrow.write.transferAdmin([newAdmin], { account: wallet.account });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`Admin transferred to ${newAdmin}`);
    break;
  }

  case "setFeeRecipient": {
    const recipient = process.env.FEE_RECIPIENT as `0x${string}` | undefined;
    if (!recipient) {
      throw new Error("FEE_RECIPIENT address required");
    }
    const hash = await escrow.write.setFeeRecipient([recipient], { account: wallet.account });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`Fee recipient set to ${recipient}`);
    break;
  }

  default:
    throw new Error(
      `Unknown ACTION "${ACTION}". Use balance|getGame|listGames|createMulti|joinMulti|createSingle|resolve|cancel|transferAdmin|setFeeRecipient`
    );
}
