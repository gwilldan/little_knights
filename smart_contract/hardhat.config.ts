import "dotenv/config";
import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";

const deployerKey = process.env.DEPLOYER_PRIVATE_KEY;

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    /** Persistent local chain — run `npm run node` first, then deploy/interact with --network localhost */
    localhost: {
      type: "http",
      chainType: "l1",
      url: "http://127.0.0.1:8545",
      accounts: deployerKey
        ? [deployerKey]
        : [
            "0xac0974bec39a17e36ba4a6b0d6542d1f6f4e2b2d5d567675f22bdb2d3522b2",
          ],
    },
    celoSepolia: {
      type: "http",
      chainType: "op",
      chainId: 11142220,
      url: process.env.CELO_SEPOLIA_RPC_URL ?? "https://forno.celo-sepolia.celo-testnet.org",
      accounts: deployerKey ? [deployerKey] : [],
    },
    celo: {
      type: "http",
      chainType: "op",
      chainId: 42220,
      url: process.env.CELO_MAINNET_RPC_URL ?? "https://forno.celo.org",
      accounts: deployerKey ? [deployerKey] : [],
    },
  },
});
