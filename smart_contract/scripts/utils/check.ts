import "dotenv/config";
import { network } from "hardhat";
import { erc20Abi, formatEther, formatUnits } from "viem";
import { loadDeployment } from "../lib/deployments.js";

/**
 * utility for checking allowance and wallet native token and stablecoin balance.
 * 
 * Examples:
 * ACTION=balance npx hardhat run scripts/utils/check.ts --network celoSepolia
 * ACTION=allowance npx hardhat run scripts/utils/check.ts --network celoSepolia
 */

const connection = await network.getOrCreate();
const { viem } = connection;
const publicClient = await viem.getPublicClient();
const wallets = await viem.getWalletClients();
const wallet = wallets[0];
const deployment = loadDeployment(connection.networkName);

console.log(`Network: ${connection.networkName}`);
console.log(`Wallet: ${wallet.account.address}`);

switch (process.env.ACTION) {
  case "balance": {
    const nativeBalance = await publicClient.getBalance({ address: wallet.account.address });
    const stablecoinBalance = await publicClient.readContract({
      address: deployment.stablecoin,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [wallet.account.address],
    });

    console.log(`Native balance: ${formatEther(nativeBalance)} CELO`);
    console.log(`Stablecoin balance: ${formatUnits(stablecoinBalance, 6)} USDC`);
    break;  
    }

    case "allowance": { 
        const allowance = await publicClient.readContract({
            address: deployment.stablecoin,
            abi: erc20Abi,
            functionName: "allowance",
            args: [wallet.account.address, deployment.escrow],
          });
          console.log(`Allowance: ${formatUnits(allowance, 6)} USDC`);
            break;  
    }

  default:
    console.log("Please set ACTION env variable to 'balance' or 'allowance'.");
}       

