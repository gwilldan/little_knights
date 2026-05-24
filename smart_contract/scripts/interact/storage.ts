import "dotenv/config";
import { network } from "hardhat";
import { erc20Abi, formatUnits, parseUnits } from "viem";
import { loadDeployment } from "../lib/deployments.js";

/**
 * Storage (house fund) interactions.
 *
 * ACTION env:
 *   balance | fund | withdraw | setManager | transferAdmin
 *
 * Examples:
 *   ACTION=balance npx hardhat run scripts/interact/storage.ts --network hardhatMainnet
 *   ACTION=fund AMOUNT=100 npx hardhat run scripts/interact/storage.ts --network celoSepolia
 *   ACTION=withdraw AMOUNT=50 npx hardhat run scripts/interact/storage.ts --network celoSepolia
 *   ACTION=setManager MANAGER=0x... npx hardhat run scripts/interact/storage.ts --network celo
 */

const ACTION = process.env.ACTION ?? "balance";
const AMOUNT = process.env.AMOUNT ?? "1";
const TOKEN_DECIMALS = Number(process.env.TOKEN_DECIMALS ?? "6");

const connection = await network.getOrCreate();
const { viem } = connection;
const publicClient = await viem.getPublicClient();
const [wallet] = await viem.getWalletClients();
const deployment = loadDeployment(connection.networkName);

const storage = await viem.getContractAt("LittleKnightsStorage", deployment.storage) as any;

const amount = parseUnits(AMOUNT, TOKEN_DECIMALS);

console.log(`Storage @ ${deployment.storage}`);
console.log(`Wallet: ${wallet.account.address}`);
console.log(`Action: ${ACTION}`);

switch (ACTION) {
  case "balance": {
    const balance = await storage.read.getBalance();
    console.log(`House balance: ${balance.toString()}`);
    break;
  }

  case "fund": {

    const approval = await publicClient.readContract({
      address: deployment.stablecoin,
      abi: erc20Abi,
      functionName: "allowance",
      args: [wallet.account.address, deployment.storage],
    });

    if (approval < amount) {
      const approveHash = await wallet.writeContract({
        address: deployment.stablecoin,
        abi: erc20Abi,
        functionName: "approve",
        args: [deployment.storage, amount],
        account: wallet.account,
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash })
    }

    const fundHash = await storage.write.fundStorage([amount], { account: wallet.account });
    await publicClient.waitForTransactionReceipt({ hash: fundHash });
    console.log(`Funded storage with ${AMOUNT} tokens`);
    console.log(`Transaction hash: ${fundHash}`);
    break;
  }

  case "withdraw": {
    const withdrawHash = await storage.write.withdrawStorage([amount], { account: wallet.account });
    await publicClient.waitForTransactionReceipt({ hash: withdrawHash });
    console.log(`Withdrew ${AMOUNT} tokens to admin`);
    break;
  }

  case "setManager": {
    const manager = process.env.MANAGER as `0x${string}` | undefined;
    if (!manager) {
      throw new Error("MANAGER address required");
    }
    const hash = await storage.write.setManager([manager], { account: wallet.account });
    await publicClient.waitForTransactionReceipt({ hash: hash });
    console.log(`Manager set to ${manager}`);
    break;
  }

  case "transferAdmin": {
    const newAdmin = process.env.NEW_ADMIN as `0x${string}` | undefined;
    if (!newAdmin) {
      throw new Error("NEW_ADMIN address required");
    }
    const hash = await storage.write.transferAdmin([newAdmin], { account: wallet.account });
    await publicClient.waitForTransactionReceipt({ hash: hash });
    console.log(`Admin transferred to ${newAdmin}`);
    break;
  }

  default:
    throw new Error(`Unknown ACTION "${ACTION}". Use balance|fund|withdraw|setManager|transferAdmin`);
}
