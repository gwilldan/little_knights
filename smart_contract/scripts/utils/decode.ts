import "dotenv/config";
import { network } from "hardhat";
import {decodeFunctionData } from "viem";
import { loadDeployment } from "../lib/deployments.js";


/**
 * Utility for decoding and inspecting game data.
 *
 * Examples:
 *   ACTION=escrow npx hardhat run scripts/utils/decode.ts --network celoSepolia
 *   ACTION=storage npx hardhat run scripts/utils/decode.ts --network celoSepolia
 */

const connection = await network.getOrCreate();
const { viem } = connection;
const wallets = await viem.getWalletClients();
const wallet = wallets[0];
const deployment = loadDeployment(connection.networkName);

const escrow = await viem.getContractAt("LittleKnightsEscrowManager", deployment.escrow);

console.log(`Escrow @ ${deployment.escrow}`);
console.log(`Wallet: ${wallet.account.address}`);

switch (process.env.ACTION) {
  case "escrow": {
    const inputData = process.env.INPUT_DATA as `0x${string}`;
    if (!inputData) {
      console.error("Please provide INPUT_DATA env variable.");
      process.exit(1);
    }

    try {
      const decoded = decodeFunctionData({
        abi: escrow.abi,
        data: inputData
      });
      console.log("Decoded function call:", decoded);
    } catch (error) {
      console.error("Failed to decode input data:", error);
    }
    break;
  }

    case "storage": {
    const inputData = process.env.INPUT_DATA as `0x${string}`;
    if (!inputData) {
      console.error("Please provide INPUT_DATA env variable.");
      process.exit(1);
    }

    try {
      const decoded = decodeFunctionData({
        abi: escrow.abi,
        data: inputData
      });
      console.log("Decoded function call:", decoded);
    } catch (error) {
      console.error("Failed to decode input data:", error);
    }
    break;
  }

  case "gameData": {
    const gameId = process.env.GAME_ID;
    if (!gameId) {
      console.error("Please provide GAME_ID env variable.");
      process.exit(1);
    }

    // await decodeGame(gameId);
    break;
  }

  default:
    console.error("Invalid ACTION. Use 'escrow' | 'storage' | 'gameData'.");
}