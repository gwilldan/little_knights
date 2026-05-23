export type DeploymentNetwork =
  | "hardhatMainnet"
  | "hardhatOp"
  | "celoSepolia"
  | "celo";

export const LOCAL_NETWORKS = new Set<DeploymentNetwork>(["hardhatMainnet", "hardhatOp"]);

/** Default stablecoins — override with STABLECOIN_ADDRESS in .env */
export const DEFAULT_STABLECOIN: Partial<Record<DeploymentNetwork, `0x${string}`>> = {
  celo: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
  celoSepolia: "0x01C5C0122039549AD1493B8220cABEdD739BC44E",
};

export function isLocalNetwork(networkName: string): networkName is DeploymentNetwork {
  return LOCAL_NETWORKS.has(networkName as DeploymentNetwork);
}
