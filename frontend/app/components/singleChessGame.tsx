import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Wallet } from "lucide-react";
import { createPublicClient, erc20Abi, formatUnits, http } from "viem";
import { celoSepolia } from "viem/chains";
import NetworkChessGame from "~/components/networkChessGame";
import { useAppSession } from "~/utils/app-session";
import { signInUser } from "~/utils/auth";
import { saveSingleGame } from "~/utils/game";

const BET_AMOUNT = import.meta.env.VITE_BET_AMOUNT!;

export default function SingleChessGame() {
  const navigate = useNavigate();
  const { walletAddress, createSingleGame } = useAppSession();

  const [readyToPlay, setReadyToPlay] = useState(false);
  const [startLoading, setStartLoading] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string>("--");
  const [balLoading, setBalLoading] = useState<boolean>(true);

  const [roomId, setRoomId] = useState<string>(`lk-pending-${Date.now()}`);

  console.log("startloading", startLoading)

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
      setStartError("Wallet not connected.");
      setStartLoading(false);
      return;
    }

    if (usdcBalance < BET_AMOUNT) {
      setStartError("Insufficient USDC balance. Refill your wallet to play.");
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
      setStartError(
        error instanceof Error
          ? `Contract transaction failed: ${error.message}`
          : "Contract transaction failed.",
      );
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
        setStartError(
          "Contract succeeded, but saving game details on server failed.",
        );
        setStartLoading(false);
        return;
      }
    } catch (error) {
      setStartError(
        error instanceof Error
          ? `Server save failed: ${error.message}`
          : "Server save failed.",
      );
      setStartLoading(false);
      return;
    }

    const signedIn = await signInUser({
      id: walletAddress,
      name: `Player-${walletAddress.slice(2, 8)}`,
      balance: "0",
    });

    if (!signedIn) {
      setStartError("Sign in failed. Register your player before competing.");
      setStartLoading(false);
      return;
    }

    setReadyToPlay(true);
    setStartLoading(false);
  }

  return (
    <>
      <NetworkChessGame
        enabled={readyToPlay}
        mode="single"
        opponentLabel="AI"
        roomId={roomId}
        title="Single Player"
        uid={walletAddress!}
        setStartLoading={setStartLoading}
      />

      {!readyToPlay ? (
        <div className="lk-modal-backdrop lk-modal-backdrop-fixed">
          <div className="lk-modal lk-modal-dark lk-start-modal">
            <button
              aria-label="Exit to home"
              className="lk-modal-close"
              onClick={() => navigate("/")}
              type="button"
            >
              ×
            </button>

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
