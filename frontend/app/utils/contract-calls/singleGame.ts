import {
  createPublicClient,
  encodeFunctionData,
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
    const approveTxHash = await sendContractTx({
      ethereum,
      from: account,
      to: stablecoinAddress,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [escrowContractAddress, maxInt256],
      }),
    });

    await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
  }

  const gameId = keccak256(toBytes(`${walletAddress}-${Date.now()}`));

  const txHash = await sendContractTx({
    ethereum,
    from: account,
    to: escrowContractAddress,
    data: encodeFunctionData({
      abi: escrowAbi,
      functionName: "createSingleGame",
      args: [gameId, account, amount],
    }),
  });

  const txReceipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  if(!txReceipt || txReceipt.status !== "success") {
    throw new Error("Failed to create game on-chain.");
  } 

  return { gameId, txHash };
}

async function sendContractTx({
  ethereum,
  from,
  to,
  data,
}: {
  ethereum: EIP1193Provider;
  from: Address;
  to: Address;
  data: `0x${string}`;
}) {
  // Leave feeCurrency unset so MiniPay can auto-select the user's best fee token.
  const hash = await ethereum.request({
    method: "eth_sendTransaction",
    params: [
      {
        from,
        to,
        data,
      },
    ],
  });

  if (typeof hash !== "string" || !hash.startsWith("0x")) {
    throw new Error("Wallet did not return a valid transaction hash.");
  }

  return hash as `0x${string}`;
}

function readAddressEnv(key: "VITE_ESCROW_CONTRACT_ADDRESS" | "VITE_STABLECOIN_CONTRACT_ADDRESS") {
  const value = import.meta.env[key];
  if (!value || typeof value !== "string") {
    throw new Error(`${key} is not configured.`);
  }

  return value as Address;
}
