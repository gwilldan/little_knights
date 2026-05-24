import {
  createPublicClient,
  createWalletClient,
  custom,
  erc20Abi,
  http,
  keccak256,
  maxInt256,
  parseUnits,
  toBytes,
  type Address,
  type EIP1193Provider,
} from "viem";
import { celoSepolia } from "viem/chains";
import { escrowAbi } from "./abi.json";

type CreateSingleGameParams = {
  walletAddress: string;
  betAmount: string;
};

export async function createSingleGame({ walletAddress, betAmount }: CreateSingleGameParams) {
  const ethereum = (window as Window & { ethereum?: EIP1193Provider }).ethereum;
  if (!ethereum) {
    throw new Error("Wallet provider not found.");
  }

  const escrowContractAddress = readAddressEnv("VITE_ESCROW_CONTRACT_ADDRESS");
  const stablecoinAddress = readAddressEnv("VITE_STABLECOIN_CONTRACT_ADDRESS");
  const stablecoinDecimals = Number(import.meta.env.VITE_STABLECOIN_DECIMALS ?? 6);

  const account = walletAddress as Address;
  const amount = parseUnits(betAmount, stablecoinDecimals);
  if (amount <= 0n) {
    throw new Error("Bet amount must be greater than zero.");
  }

  const walletClient = createWalletClient({
    account,
    chain: celoSepolia,
    transport: custom(ethereum),
  });

  const publicClient = createPublicClient({
    chain: celoSepolia,
    transport: http(import.meta.env.VITE_CELO_RPC_URL),
  });

  const currentAllowance = await publicClient.readContract({
    address: stablecoinAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account, escrowContractAddress],
  });

  if (currentAllowance < amount) {
    const approveTxHash = await walletClient.writeContract({
      address: stablecoinAddress,
      abi: erc20Abi,
      functionName: "approve",
      args: [escrowContractAddress, maxInt256],
      account,
      chain: celoSepolia,
    });

    await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
  }

  const gameId = keccak256(toBytes(`lk-game-single-${Date.now()}`));

  const txHash = await walletClient.writeContract({
    address: escrowContractAddress,
    abi: escrowAbi,
    functionName: "createSingleGame",
    args: [gameId, account, amount],
    account,
    chain: celoSepolia,
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });

  return { gameId, txHash };
}

function readAddressEnv(key: "VITE_ESCROW_CONTRACT_ADDRESS" | "VITE_STABLECOIN_CONTRACT_ADDRESS") {
  const value = import.meta.env[key];
  if (!value || typeof value !== "string") {
    throw new Error(`${key} is not configured.`);
  }

  return value as Address;
}
