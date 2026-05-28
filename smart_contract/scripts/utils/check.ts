import "dotenv/config";
import { network } from "hardhat";
import { erc20Abi, formatEther, formatUnits } from "viem";
import { loadDeployment } from "../lib/deployments.js";

/**
 * utility for checking allowance and wallet native token and stablecoin balance.
 * 
 * Examples:
 * ACTION=balance WALLET=0x28d43e1180Be426a79746b1c56De7bC29616bD02 npx hardhat run scripts/utils/check.ts --network celoSepolia
 * ACTION=allowance WALLET=0x28d43e1180Be426a79746b1c56De7bC29616bD02 npx hardhat run scripts/utils/check.ts --network celoSepolia
 */

const address= process.env.WALLET as `0x${string}`

const connection = await network.getOrCreate();
const { viem } = connection;
const publicClient = await viem.getPublicClient();
const wallets = await viem.getWalletClients();
const viemWallet = wallets[0];
const deployment = loadDeployment(connection.networkName);

const wallet = address || viemWallet.account.address

console.log(`Network: ${connection.networkName}`);
console.log(`Wallet: ${wallet}`);

switch (process.env.ACTION) {
  case "balance": {
    const nativeBalance = await publicClient.getBalance({ address: wallet });
    const [userStablecoinBalance, storageStablecoinBalance, escrowStablecoinBalance] = await publicClient.multicall({
      contracts: [
        {
          address: deployment.stablecoin,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [wallet],
        },
        {
          address: deployment.stablecoin,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [deployment.storage],
        },
        {
          address: deployment.stablecoin,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [deployment.escrow],
        },
      ],
      allowFailure: false,
    });

    console.log(`Native balance: ${formatEther(nativeBalance)} CELO`);
    console.log(`User USDC balance: ${formatUnits(userStablecoinBalance, 6)} USDC`);
    console.log(`Storage USDC balance: ${formatUnits(storageStablecoinBalance, 6)} USDC`);
    console.log(`Escrow USDC balance: ${formatUnits(escrowStablecoinBalance, 6)} USDC`);
    break;  
    }

    case "allowance": { 
        const allowance = await publicClient.readContract({
            address: deployment.stablecoin,
            abi: erc20Abi,
            functionName: "allowance",
            args: [wallet, deployment.escrow],
          });
          console.log(`Allowance: ${formatUnits(allowance, 6)} USDC`);
            break;  
    }

  default:
    console.log("Please set ACTION env variable to 'balance' or 'allowance'.");
}       
