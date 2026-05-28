import "dotenv/config";
import { network } from "hardhat";
import { isAddress, type Address, type Hash } from "viem";
import { DEFAULT_STABLECOIN, isLocalNetwork } from "./lib/networks.js";
import { loadDeployment, saveDeployment, type DeploymentRecord } from "./lib/deployments.js";

/**
 * Dynamic LittleKnights deployments.
 *
 * ACTION env:
 *   deployAll      Deploy new storage + new escrow, then set storage manager to escrow.
 *   deployStorage  Deploy new storage and set its manager to an existing escrow.
 *   deployEscrow   Deploy new escrow against an existing storage, then set storage manager to escrow.
 *
 * Aliases:
 *   all | deployAll
 *   storage | deployStorage
 *   escrow | deployEscrow
 *
 * Examples:
 *   ACTION=deployAll npx hardhat run scripts/deploy.ts --network celoSepolia
 *   ACTION=deployStorage ESCROW_ADDRESS=0x... npx hardhat run scripts/deploy.ts --network celoSepolia
 *   ACTION=deployEscrow STORAGE_ADDRESS=0x... npx hardhat run scripts/deploy.ts --network celoSepolia
 *
 * Notes:
 *   LittleKnightsEscrowManager stores its storage address in the constructor.
 *   ACTION=deployStorage can deploy storage with manager=existing escrow, but it cannot make
 *   that existing escrow use the new storage unless the escrow contract itself supports that.
 */

type DeployAction = "deployAll" | "deployStorage" | "deployEscrow";

const connection = await network.getOrCreate();
const { viem } = connection;
const publicClient = await viem.getPublicClient();
const [deployer] = await viem.getWalletClients();
const networkName = connection.networkName;
const chainId = await publicClient.getChainId();
const existingDeployment = tryLoadDeployment(networkName);
const action = parseAction(process.env.ACTION);

console.log(`Network: ${networkName} (chainId ${chainId})`);
console.log(`Deployer: ${deployer.account.address}`);
console.log(`Action: ${action}`);

switch (action) {
  case "deployAll": {
    const stablecoinAddress = await resolveStablecoinAddress();
    const feeRecipient = readOptionalAddress("FEE_RECIPIENT") ?? deployer.account.address;

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

    await setStorageManager(storage.address, escrow.address);

    saveAndPrintDeployment({
      stablecoin: stablecoinAddress,
      storage: storage.address,
      escrow: escrow.address,
      feeRecipient,
    });
    break;
  }

  case "deployStorage": {
    const escrowAddress = resolveRequiredAddress(
      ["ESCROW_ADDRESS", "EXISTING_ESCROW_ADDRESS", "ESCROW", "EXISTING_ESCROW"],
      existingDeployment?.escrow,
      "Set ESCROW_ADDRESS or deploy both contracts first."
    );
    const stablecoinAddress = await resolveStablecoinAddressFromExistingEscrow(escrowAddress);
    const feeRecipient = await readEscrowFeeRecipient(escrowAddress);

    console.log("Deploying LittleKnightsStorage...");
    const storage = await viem.deployContract("LittleKnightsStorage", [
      stablecoinAddress,
      escrowAddress,
    ]);
    console.log(`LittleKnightsStorage: ${storage.address}`);
    console.log(`Storage manager set to existing escrow: ${escrowAddress}`);
    console.log(
      "Heads up: existing escrow contracts keep their storage address from construction, so this does not repoint the escrow."
    );

    saveAndPrintDeployment({
      stablecoin: stablecoinAddress,
      storage: storage.address,
      escrow: escrowAddress,
      feeRecipient,
    });
    break;
  }

  case "deployEscrow": {
    const storageAddress = resolveRequiredAddress(
      ["STORAGE_ADDRESS", "EXISTING_STORAGE_ADDRESS", "STORAGE", "EXISTING_STORAGE"],
      existingDeployment?.storage,
      "Set STORAGE_ADDRESS or deploy both contracts first."
    );
    const storage = await viem.getContractAt("LittleKnightsStorage", storageAddress);
    const stablecoinAddress = (await storage.read.stablecoin()) as Address;
    const feeRecipient = readOptionalAddress("FEE_RECIPIENT") ?? existingDeployment?.feeRecipient ?? deployer.account.address;

    console.log("Deploying LittleKnightsEscrowManager...");
    const escrow = await viem.deployContract("LittleKnightsEscrowManager", [
      stablecoinAddress,
      storageAddress,
      feeRecipient,
    ]);
    console.log(`LittleKnightsEscrowManager: ${escrow.address}`);

    await setStorageManager(storageAddress, escrow.address);

    saveAndPrintDeployment({
      stablecoin: stablecoinAddress,
      storage: storageAddress,
      escrow: escrow.address,
      feeRecipient,
    });
    break;
  }

  default:
    assertNever(action);
}

function parseAction(value: string | undefined): DeployAction {
  switch (value ?? "deployAll") {
    case "all":
    case "deployAll":
      return "deployAll";
    case "storage":
    case "deployStorage":
      return "deployStorage";
    case "escrow":
    case "deployEscrow":
      return "deployEscrow";
    default:
      throw new Error(`Unknown ACTION "${value}". Use deployAll|deployStorage|deployEscrow`);
  }
}

async function resolveStablecoinAddress() {
  const envStablecoin = readOptionalAddress("STABLECOIN_ADDRESS");
  if (envStablecoin) {
    return envStablecoin;
  }

  if (existingDeployment?.stablecoin) {
    console.log(`Using stablecoin from existing deployment: ${existingDeployment.stablecoin}`);
    return existingDeployment.stablecoin;
  }

  const fallback = DEFAULT_STABLECOIN[networkName as keyof typeof DEFAULT_STABLECOIN];
  if (fallback) {
    console.log(`Using default stablecoin for ${networkName}: ${fallback}`);
    return fallback;
  }

  if (isLocalNetwork(networkName)) {
    console.log("Deploying MockStablecoin for local VM...");
    const mock = await viem.deployContract("MockStablecoin");
    console.log(`MockStablecoin: ${mock.address}`);
    return mock.address;
  }

  throw new Error("Set STABLECOIN_ADDRESS in .env for this network");
}

async function resolveStablecoinAddressFromExistingEscrow(escrowAddress: Address) {
  const envStablecoin = readOptionalAddress("STABLECOIN_ADDRESS");
  const escrow = await viem.getContractAt("LittleKnightsEscrowManager", escrowAddress);
  const escrowStablecoin = (await escrow.read.stablecoin()) as Address;

  if (envStablecoin && sameAddress(envStablecoin, escrowStablecoin)) {
    return envStablecoin;
  }

  if (envStablecoin) {
    throw new Error(
      `STABLECOIN_ADDRESS (${envStablecoin}) does not match existing escrow stablecoin (${escrowStablecoin}).`
    );
  }

  return escrowStablecoin;
}

async function readEscrowFeeRecipient(escrowAddress: Address) {
  const envFeeRecipient = readOptionalAddress("FEE_RECIPIENT");
  if (envFeeRecipient) {
    return envFeeRecipient;
  }

  const escrow = await viem.getContractAt("LittleKnightsEscrowManager", escrowAddress);
  return (await escrow.read.feeRecipient()) as Address;
}

async function setStorageManager(storageAddress: Address, managerAddress: Address) {
  const storage = await viem.getContractAt("LittleKnightsStorage", storageAddress);
  const currentManager = (await storage.read.manager()) as Address;

  if (sameAddress(currentManager, managerAddress)) {
    console.log(`Storage manager already set to ${managerAddress}`);
    return;
  }

  console.log(`Linking storage manager -> ${managerAddress}...`);
  const hash = await storage.write.setManager([managerAddress], { account: deployer.account });
  await waitForSuccess(hash);
  console.log("Manager linked.");
}

async function waitForSuccess(hash: Hash) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Transaction failed: ${hash}`);
  }
}

function saveAndPrintDeployment(addresses: Pick<DeploymentRecord, "stablecoin" | "storage" | "escrow" | "feeRecipient">) {
  const record: DeploymentRecord = {
    network: networkName,
    chainId,
    deployer: deployer.account.address,
    ...addresses,
    deployedAt: new Date().toISOString(),
  };

  saveDeployment(record);

  console.log("\nDeployment complete:");
  console.log(JSON.stringify(record, null, 2));
}

function readOptionalAddress(key: string): Address | undefined {
  const value = process.env[key];
  if (!value) {
    return undefined;
  }

  if (!isAddress(value)) {
    throw new Error(`${key} must be a valid address.`);
  }

  return value;
}

function resolveRequiredAddress(keys: string[], fallback: Address | undefined, message: string) {
  for (const key of keys) {
    const address = readOptionalAddress(key);
    if (address) {
      return address;
    }
  }

  if (fallback) {
    console.log(`Using ${keys[0]} from existing deployment: ${fallback}`);
    return fallback;
  }

  throw new Error(message);
}

function tryLoadDeployment(name: string) {
  try {
    return loadDeployment(name);
  } catch {
    return undefined;
  }
}

function sameAddress(left: Address, right: Address) {
  return left.toLowerCase() === right.toLowerCase();
}

function assertNever(value: never): never {
  throw new Error(`Unhandled action: ${value}`);
}
