import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Wallet } from "lucide-react";
import { createPublicClient, erc20Abi, formatUnits, http, keccak256, toBytes } from "viem";
import { celoSepolia } from "viem/chains";
import NetworkChessGame from "~/components/networkChessGame";
import { useAppSession, signInUser, saveSingleGame, getOrCreateUid } from "~/utils";


export default function SingleChessGame() {
  const navigate = useNavigate();
  const { walletAddress, createSingleGame } = useAppSession();

  const [readyToPlay, setReadyToPlay] = useState(false);
  const [startLoading, setStartLoading] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string>("--");

  const uid = useMemo(() => getOrCreateUid(walletAddress), [walletAddress]);
  const roomId = useMemo(() => keccak256(toBytes(`lk-game-${Date.now()}`)), [uid]);

  useEffect(() => {
    if (!walletAddress) {
      setUsdcBalance("--");
      return;
    }

    let active = true;

    async function loadUsdcBalance() {
      try {
        const stablecoinAddress = import.meta.env.VITE_STABLECOIN_CONTRACT_ADDRESS;
        const stablecoinDecimals = Number(import.meta.env.VITE_STABLECOIN_DECIMALS ?? 6);
        if (!stablecoinAddress) {
          if (active) setUsdcBalance("--");
          return;
        }

        const publicClient = createPublicClient({
          chain: celoSepolia,
          transport: http(import.meta.env.VITE_CELO_RPC_URL),
        });

        const balance = await publicClient.readContract({
          address: stablecoinAddress,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [walletAddress as `0x${string}`],
        });

        if (!active) return;
        setUsdcBalance(Number(formatUnits(balance, stablecoinDecimals)).toFixed(2));
      } catch {
        if (active) setUsdcBalance("--");
      }
    }

    loadUsdcBalance();
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

    let gameId = "";
    let txHash = "";

    try {
      const result = await createSingleGame("1");
      gameId = result.gameId;
      txHash = result.txHash;
    } catch (error) {
      setStartError(error instanceof Error ? `Contract transaction failed: ${error.message}` : "Contract transaction failed.");
      setStartLoading(false);
      return;
    }

    try {
      const saved = await saveSingleGame({
        roomId,
        gameId,
        txHash,
        walletAddress,
        betAmount: "1",
        uid,
      });

      if (!saved) {
        setStartError("Contract succeeded, but saving game details on server failed.");
        setStartLoading(false);
        return;
      }
    } catch (error) {
      setStartError(error instanceof Error ? `Server save failed: ${error.message}` : "Server save failed.");
      setStartLoading(false);
      return;
    }

    const signedIn = await signInUser(uid);
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
      <NetworkChessGame enabled={readyToPlay} mode="single" opponentLabel="AI" roomId={roomId} title="Single Player" uid={uid} />

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
              Entry costs $1. Win against the bot and take home $2 (100% profit). If your clock hits zero, you lose.
            </p>
            <p className="lk-start-terms">By proceeding, you agree to the competition terms.</p>

            {startError ? <p className="lk-start-error">{startError}</p> : null}

            <button
              className="lk-action-btn lk-action-primary lk-start-play"
              disabled={startLoading}
              onClick={handleStartPlay}
              type="button"
            >
              {startLoading ? "Preparing..." : "Play"}
            </button>

            <div className="lk-start-wallet-block">
              <p className="lk-start-wallet-line flex items-center gap-1">
                <Wallet size={14} />
                {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "Not connected"}
              </p>
              <p className="lk-start-wallet-line">USDC Balance: {usdcBalance}</p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
