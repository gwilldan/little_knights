import {
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  http,
  keccak256,
  maxInt256,
  parseUnits,
  toHex,
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

export type CreateSingleGameErrorCode =
  | "WALLET_PROVIDER_NOT_FOUND"
  | "INVALID_BET_AMOUNT"
  | "ALLOWANCE_CHECK_FAILED"
  | "APPROVAL_REJECTED"
  | "APPROVAL_REVERTED"
  | "APPROVAL_TX_FAILED"
  | "APPROVAL_RECEIPT_FAILED"
  | "CREATE_TX_REJECTED"
  | "CREATE_TX_REVERTED"
  | "CREATE_TX_FAILED"
  | "CREATE_GAS_ESTIMATE_FAILED"
  | "CREATE_RECEIPT_FAILED";

export class CreateSingleGameError extends Error {
  code: CreateSingleGameErrorCode;

  constructor(code: CreateSingleGameErrorCode, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "CreateSingleGameError";
    this.code = code;
    if (options?.cause) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export async function createSingleGame({ walletAddress, betAmount }: CreateSingleGameParams) {
  const ethereum = (window as Window & { ethereum?: EIP1193Provider }).ethereum;
  if (!ethereum) {
    throw new CreateSingleGameError(
      "WALLET_PROVIDER_NOT_FOUND",
      "Wallet provider not found.",
    );
  }

  const escrowContractAddress = readAddressEnv("VITE_ESCROW_CONTRACT_ADDRESS");
  const stablecoinAddress = readAddressEnv("VITE_STABLECOIN_CONTRACT_ADDRESS");
  const stablecoinDecimals = Number(import.meta.env.VITE_STABLECOIN_DECIMALS ?? 6);

  const account = walletAddress as Address;
  const amount = parseUnits(betAmount, stablecoinDecimals);
  if (amount <= 0n) {
    throw new CreateSingleGameError(
      "INVALID_BET_AMOUNT",
      "Bet amount must be greater than zero.",
    );
  }

  const publicClient = createPublicClient({
    chain: celoSepolia,
    transport: http(import.meta.env.VITE_CELO_RPC_URL),
  });

  let currentAllowance = 0n;
  try {
    currentAllowance = await publicClient.readContract({
      address: stablecoinAddress,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account, escrowContractAddress],
    });
  } catch (error) {
    throw new CreateSingleGameError(
      "ALLOWANCE_CHECK_FAILED",
      "Failed to check allowance.",
      { cause: error },
    );
  }

  if (currentAllowance < amount) {
    const approveData = encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [escrowContractAddress, maxInt256],
    });

    const approveTxHash = await sendContractTx({
      ethereum,
      from: account,
      to: stablecoinAddress,
      data: approveData,
      step: "approve",
    });

    const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
    if (!approveReceipt || approveReceipt.status !== "success") {
      throw new CreateSingleGameError(
        "APPROVAL_RECEIPT_FAILED",
        "Approval transaction failed.",
      );
    }
  }

  const gameId = keccak256(toBytes(`${walletAddress}-${Date.now()}`));
  const createGameData = encodeFunctionData({
    abi: escrowAbi,
    functionName: "createSingleGame",
    args: [gameId, account, amount],
  });

  let createGameGas = 0n;
  try {
    createGameGas = await publicClient.estimateGas({
      account,
      to: escrowContractAddress,
      data: createGameData,
    });
  } catch (error) {
    if (isExecutionRevertedError(error)) {
      throw new CreateSingleGameError(
        "CREATE_TX_REVERTED",
        "Create game transaction reverted.",
        { cause: error },
      );
    }

    throw new CreateSingleGameError(
      "CREATE_GAS_ESTIMATE_FAILED",
      "Failed to estimate create-game gas.",
      { cause: error },
    );
  }

  const txHash = await sendContractTx({
    ethereum,
    from: account,
    to: escrowContractAddress,
    data: createGameData,
    gas: withGasBuffer(createGameGas),
    step: "create",
  });

  const txReceipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  if (!txReceipt || txReceipt.status !== "success") {
    throw new CreateSingleGameError(
      "CREATE_RECEIPT_FAILED",
      "Create game transaction failed.",
    );
  }

  return { gameId, txHash };
}

async function sendContractTx({
  ethereum,
  from,
  to,
  data,
  gas,
  step,
}: {
  ethereum: EIP1193Provider;
  from: Address;
  to: Address;
  data: `0x${string}`;
  gas?: bigint;
  step: "approve" | "create";
}) {
  // Leave feeCurrency unset so MiniPay can auto-select the user's best fee token.
  let hash: unknown;
  try {
    hash = await ethereum.request({
      method: "eth_sendTransaction",
      params: [
        {
          from,
          to,
          data,
          ...(gas ? { gas: toHex(gas) } : {}),
        },
      ],
    });
  } catch (error) {
    const message = getErrorMessage(error).toLowerCase();
    if (isUserRejectedError(error)) {
      throw new CreateSingleGameError(
        step === "approve" ? "APPROVAL_REJECTED" : "CREATE_TX_REJECTED",
        "User rejected transaction.",
        { cause: error },
      );
    }

    if (isExecutionRevertedError(error)) {
      throw new CreateSingleGameError(
        step === "approve" ? "APPROVAL_REVERTED" : "CREATE_TX_REVERTED",
        "Transaction reverted.",
        { cause: error },
      );
    }

    throw new CreateSingleGameError(
      step === "approve" ? "APPROVAL_TX_FAILED" : "CREATE_TX_FAILED",
      `Failed to send ${step} transaction: ${message}`,
      { cause: error },
    );
  }

  if (typeof hash !== "string" || !hash.startsWith("0x")) {
    throw new CreateSingleGameError(
      step === "approve" ? "APPROVAL_TX_FAILED" : "CREATE_TX_FAILED",
      "Wallet did not return a valid transaction hash.",
    );
  }

  return hash as `0x${string}`;
}

function withGasBuffer(gas: bigint) {
  // Add 20% buffer to reduce wallet-side estimate retries/failures.
  return gas + gas / 5n;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (typeof error === "object" && error !== null) {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string") {
      return maybeMessage;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

function isUserRejectedError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  const code = typeof error === "object" && error !== null
    ? (error as { code?: unknown }).code
    : undefined;

  return (
    code === 4001 ||
    message.includes("user rejected") ||
    message.includes("user denied") ||
    message.includes("rejected the request")
  );
}

function isExecutionRevertedError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  const code = typeof error === "object" && error !== null
    ? (error as { code?: unknown }).code
    : undefined;

  return (
    code === 3 ||
    message.includes("execution reverted") ||
    message.includes("eth_estimategas failed") ||
    message.includes("eth_estimategas")
  );
}

function readAddressEnv(key: "VITE_ESCROW_CONTRACT_ADDRESS" | "VITE_STABLECOIN_CONTRACT_ADDRESS") {
  const value = import.meta.env[key];
  if (!value || typeof value !== "string") {
    throw new Error(`${key} is not configured.`);
  }

  return value as Address;
}
