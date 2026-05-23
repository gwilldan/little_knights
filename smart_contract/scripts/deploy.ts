import "dotenv/config";
import { network } from "hardhat";
import { DEFAULT_STABLECOIN, isLocalNetwork } from "./lib/networks.js";
import { saveDeployment, type DeploymentRecord } from "./lib/deployments.js";

/**
 * Deploys LittleKnightsStorage then LittleKnightsEscrowManager.
 *
 * Storage is deployed with the deployer as temporary manager, then manager is
 * set to the escrow contract after escrow deploy.
 *
 * Local VM networks deploy MockStablecoin when STABLECOIN_ADDRESS is unset.
 */
// const connection = await networkman;

const connection = await network.getOrCreate();
const { viem } = connection;
const publicClient = await viem.getPublicClient();
const [deployer] = await viem.getWalletClients();
const networkName = connection.networkName;
const chainId = await publicClient.getChainId();

console.log(`Network: ${networkName} (chainId ${chainId})`);
console.log(`Deployer: ${deployer.account.address}`);

let stablecoinAddress = process.env.STABLECOIN_ADDRESS as `0x${string}` | undefined;

if (!stablecoinAddress) {
  const fallback = DEFAULT_STABLECOIN[networkName as keyof typeof DEFAULT_STABLECOIN];
  if (fallback) {
    stablecoinAddress = fallback;
    console.log(`Using default stablecoin for ${networkName}: ${stablecoinAddress}`);
  }
}

if (!stablecoinAddress && isLocalNetwork(networkName)) {
  console.log("Deploying MockStablecoin for local VM...");
  const mock = await viem.deployContract("MockStablecoin");
  stablecoinAddress = mock.address;
  console.log(`MockStablecoin: ${stablecoinAddress}`);
}

if (!stablecoinAddress) {
  throw new Error("Set STABLECOIN_ADDRESS in .env for this network");
}

const feeRecipient = (process.env.FEE_RECIPIENT ?? deployer.account.address) as `0x${string}`;

console.log("Deploying LittleKnightsStorage...");
const storage = await viem.deployContract("LittleKnightsStorage", [
  stablecoinAddress,
  deployer.account.address,
]);

console.log(`LittleKnightsStorage: ${storage.address}`);

console.log("Deploying LittleKnightsEscrowManager...");
const escrow = await viem.deployContract("LittleKnightsEscrowManager", [
  stablecoinAddress,
  storage.address,
  feeRecipient,
]);

console.log(`LittleKnightsEscrowManager: ${escrow.address}`);

console.log("Linking storage manager → escrow...");
const setManagerHash = await (storage as any)?.write.setManager([escrow.address]);
await publicClient.waitForTransactionReceipt({ hash: setManagerHash });
console.log("Manager linked.");

const record: DeploymentRecord = {
  network: networkName,
  chainId,
  deployer: deployer.account.address,
  stablecoin: stablecoinAddress,
  storage: storage.address,
  escrow: escrow.address,
  feeRecipient,
  deployedAt: new Date().toISOString(),
};

saveDeployment(record);

console.log("\nDeployment complete:");
console.log(JSON.stringify(record, null, 2));
