import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Wallet } from "lucide-react";
import { createPublicClient, erc20Abi, formatUnits, http } from "viem";
import { celoSepolia } from "viem/chains";
import NetworkChessGame from "~/components/networkChessGame";
import { useAppSession } from "~/utils/app-session";
import { signInUser } from "~/utils/auth";
import { saveSingleGame } from "~/utils/game";
import { CreateSingleGameError } from "~/utils/contract-calls/singleGame";
import ExitButton from "./exitButton";

const BET_AMOUNT = import.meta.env.VITE_BET_AMOUNT!;
const INSUFFICIENT_BALANCE_ERROR = "Insufficient USDC balance. Refill your wallet to play.";
const REJECTED_TRANSACTION_ERROR = "You've rejected transaction error";
const GENERIC_ERROR = "Action failed.";

function getCreateGameErrorMessage(error: unknown) {
  if (!(error instanceof CreateSingleGameError)) {
    return GENERIC_ERROR;
  }

  switch (error.code) {
    case "WALLET_PROVIDER_NOT_FOUND":
      return "Wallet not connected.";
    case "INVALID_BET_AMOUNT":
      return "Invalid bet amount.";
    case "ALLOWANCE_CHECK_FAILED":
      return "Allowance check failed.";
    case "APPROVAL_REJECTED":
    case "CREATE_TX_REJECTED":
      return REJECTED_TRANSACTION_ERROR;
    case "APPROVAL_REVERTED":
      return "Approval tx reverted.";
    case "APPROVAL_TX_FAILED":
    case "APPROVAL_RECEIPT_FAILED":
      return "Approval failed.";
    case "CREATE_TX_REVERTED":
      return "Game tx reverted.";
    case "CREATE_GAS_ESTIMATE_FAILED":
      return "Game tx estimate failed.";
    case "CREATE_TX_FAILED":
      return "Failed to send game tx.";
    case "CREATE_RECEIPT_FAILED":
      return "Game tx failed.";
    default:
      return GENERIC_ERROR;
  }
}

export default function SingleChessGame() {
  const { walletAddress, createSingleGame } = useAppSession();

  const [readyToPlay, setReadyToPlay] = useState(false);
  const [startLoading, setStartLoading] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string>("--");
  const [balLoading, setBalLoading] = useState<boolean>(true);

  const [roomId, setRoomId] = useState<string>(`lk-pending-${Date.now()}`);

  useEffect(() => {
    setBalLoading(true);
    if (!walletAddress) {
      setUsdcBalance("--");
      return;
    }

    let active = true;

    (async () => {
      async function loadUsdcBalance() {
        try {
          const stablecoinAddress = import.meta.env
            .VITE_STABLECOIN_CONTRACT_ADDRESS;
          const stablecoinDecimals = Number(
            import.meta.env.VITE_STABLECOIN_DECIMALS ?? 6,
          );
          if (!stablecoinAddress) {
            if (active) setUsdcBalance("--");
            return;
          }

          const publicClient = createPublicClient({
            chain: celoSepolia,
            transport: http(),
          });

          const balance = await publicClient.readContract({
            address: stablecoinAddress,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [walletAddress as `0x${string}`],
          });

          if (!active) return;
          setUsdcBalance(
            Number(formatUnits(balance, stablecoinDecimals)).toFixed(2),
          );
        } catch {
          if (active) setUsdcBalance("--");
        }
      }

      await loadUsdcBalance();
      setBalLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [walletAddress]);

  async function handleStartPlay() {
    setStartLoading(true);
    setStartError(null);

    if (!walletAddress) {
      console.error("[single-game] Wallet not connected.");
      setStartError("Wallet not connected.");
      setStartLoading(false);
      return;
    }

    if (usdcBalance < BET_AMOUNT) {
      console.error("[single-game] Insufficient USDC balance.", {
        walletAddress,
        usdcBalance,
        betAmount: BET_AMOUNT,
      });
      setStartError(INSUFFICIENT_BALANCE_ERROR);
      setStartLoading(false);
      return;
    }

    let gameId = "";
    let txHash = "";

    try {
      const result = await createSingleGame(BET_AMOUNT);
      gameId = result.gameId;
      txHash = result.txHash;
      setRoomId(result.gameId);
    } catch (error) {
      console.error("[single-game] createSingleGame failed.", error);
      setStartError(getCreateGameErrorMessage(error));
      setStartLoading(false);
      return;
    }

    try {
      const saved = await saveSingleGame({
        roomId: gameId,
        uid: walletAddress,
        amount: BET_AMOUNT,
        txHash,
      });

      if (!saved) {
        console.error("[single-game] saveSingleGame returned false.", {
          roomId: gameId,
          uid: walletAddress,
        });
        setStartError("Failed to save game.");
        setStartLoading(false);
        return;
      }
    } catch (error) {
      console.error("[single-game] saveSingleGame request failed.", error);
      setStartError("Failed to save game.");
      setStartLoading(false);
      return;
    }

    let signedIn = false;
    try {
      signedIn = await signInUser({
        id: walletAddress,
        name: `Player-${walletAddress.slice(2, 8)}`,
        balance: "0",
      });
    } catch (error) {
      console.error("[single-game] signInUser failed.", error);
      setStartError("Sign-in failed.");
      setStartLoading(false);
      return;
    }

    if (!signedIn) {
      console.error("[single-game] signInUser returned false.");
      setStartError("Sign-in failed.");
      setStartLoading(false);
      return;
    }

    setReadyToPlay(true);
    setStartLoading(false);
  }

  function handlePlayAgain() {
    setReadyToPlay(false);
    setStartLoading(false);
    setStartError(null);
    setRoomId(`lk-pending-${Date.now()}`);
  }

  return (
    <>
      <NetworkChessGame
        key={roomId}
        enabled={readyToPlay}
        mode="single"
        opponentLabel="AI"
        onSinglePlayAgain={handlePlayAgain}
        roomId={roomId}
        title="Single Player"
        uid={walletAddress!}
        setStartLoading={setStartLoading}
      />

      {!readyToPlay ? (
        <div className="lk-modal-backdrop lk-modal-backdrop-fixed">
          <div className="lk-modal lk-modal-dark lk-start-modal">
           <ExitButton />

            <div aria-hidden className="lk-start-loader">
              <span className="lk-start-loader-piece">♞</span>
              <span className="lk-start-loader-ring" />
            </div>

            <p className="lk-start-kicker">Timed Competition</p>
            <h2>Little Knights</h2>
            <p className="lk-start-copy">
              Entry costs ${BET_AMOUNT}. Win against the bot and take home ${BET_AMOUNT * 2}
              (100% profit). If your clock hits zero, you lose.
            </p>
            <p className="lk-start-terms">
              By proceeding, you agree to the competition terms.
            </p>

            {startError ? (
              <p className="bg-red-200/80 border border-red-500 text-red-700 p-2">
                {startError}
              </p>
            ) : null}

            <button
              className="lk-action-btn lk-action-primary lk-start-play"
              disabled={balLoading}
              onClick={handleStartPlay}
              type="button"
            >
              {startLoading ? "Preparing..." : "Play"}
            </button>

            <div className="flex items-center justify-between">
              <p className="lk-start-wallet-line flex items-center gap-1">
                <Wallet size={14} />
                {walletAddress
                  ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
                  : "Not connected"}
              </p>
              <p className="lk-start-wallet-line">${usdcBalance} USDC</p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
