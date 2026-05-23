import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

export type DeploymentRecord = {
  network: string;
  chainId: number;
  deployer: `0x${string}`;
  stablecoin: `0x${string}`;
  storage: `0x${string}`;
  escrow: `0x${string}`;
  feeRecipient: `0x${string}`;
  deployedAt: string;
};

const DEPLOYMENTS_DIR = join(process.cwd(), "deployments");

export function getDeploymentPath(network: string) {
  return join(DEPLOYMENTS_DIR, `${network}.json`);
}

export function saveDeployment(record: DeploymentRecord) {
  mkdirSync(DEPLOYMENTS_DIR, { recursive: true });
  writeFileSync(getDeploymentPath(record.network), JSON.stringify(record, null, 2));
  console.log(`Saved deployment → deployments/${record.network}.json`);
}

export function loadDeployment(network: string): DeploymentRecord {
  const path = getDeploymentPath(network);
  if (!existsSync(path)) {
    throw new Error(`No deployment for "${network}". Run: npm run deploy:${network === "celoSepolia" ? "celo-sepolia" : network}`);
  }

  return JSON.parse(readFileSync(path, "utf8")) as DeploymentRecord;
}
