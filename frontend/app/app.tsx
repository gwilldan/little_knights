import { Outlet } from "react-router";
import { useEffect, useMemo, useState } from "react";
import { AppSessionContext, makeGameId, type AppSessionState } from "./utils/app-session";

export default function App() {
  const [status, setStatus] = useState<AppSessionState["status"]>("loading");
  const [isDesktopWidth, setIsDesktopWidth] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isMiniPay, setIsMiniPay] = useState(false);
  const [healthOk, setHealthOk] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [gameCount, setGameCount] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onResize = () => {
      setIsDesktopWidth(window.innerWidth > 1024);
    };

    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        setStatus("loading");

        const walletTask = connectMiniPayWallet();
        const healthTask = checkBackendHealth();

        const [walletResult, healthResult] = await Promise.all([walletTask, healthTask]);
        if (!active) return;

        setIsMiniPay(walletResult.isMiniPay);
        setWalletAddress(walletResult.address);
        setHealthOk(healthResult);
        setStatus("ready");
      } catch (error) {
        if (!active) return;
        setStatus("error");
        setLastError(error instanceof Error ? error.message : "Initialization failed.");
      }
    }

    initialize();
    return () => {
      active = false;
    };
  }, []);

  const session = useMemo<AppSessionState>(() => {
    return {
      status,
      walletAddress,
      isMiniPay,
      healthOk,
      gameCount,
      lastError,
      async createSingleGame(betAmount: string) {
        if (!walletAddress) {
          throw new Error("Wallet not connected.");
        }

        const gameId = makeGameId(gameCount);
        setGameCount((count) => count + 1);

        // Placeholder for smart contract + server create call.
        await new Promise((resolve) => setTimeout(resolve, 650));
        const txHash = `0x${gameId.replaceAll("-", "").padEnd(64, "0").slice(0, 64)}`;
        void betAmount;

        return { gameId, txHash };
      },
    };
  }, [gameCount, healthOk, isMiniPay, lastError, status, walletAddress]);

  if (status !== "ready") {
    return (
      <AppSessionContext.Provider value={session}>
        <AppLoader />
      </AppSessionContext.Provider>
    );
  }

  if (isDesktopWidth) {
    return (
      <main className="lk-loader-screen">
        <section className="lk-modal lk-modal-dark">
          <h2>No desktop</h2>
          <p>Open in &quot;No desktop Minipay only&quot;</p>
        </section>
      </main>
    );
  }

  return (
    <AppSessionContext.Provider value={session}>
      <Outlet />
    </AppSessionContext.Provider>
  );
}

async function checkBackendHealth() {
  const API_URL =
    import.meta.env.MODE === "production" ? "https://api.chess.gwilldan.xyz" : "http://localhost:8080";

  try {
    const response = await fetch(`${API_URL}/health`, { method: "GET" });
    return response.ok;
  } catch {
    return false;
  }
}

async function connectMiniPayWallet() {
  const browserWindow = typeof window === "undefined" ? undefined : (window as Window & { ethereum?: unknown });

  if (!browserWindow?.ethereum) {
    return { isMiniPay: false, address: null as string | null };
  }

  const provider = browserWindow.ethereum as {
    isMiniPay?: boolean;
    request?: (args: { method: string }) => Promise<unknown>;
  };

  const isMiniPay = provider.isMiniPay === true;
  if (!provider.request) {
    return { isMiniPay, address: null as string | null };
  }

  try {
    const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
    return { isMiniPay, address: accounts[0] ?? null };
  } catch {
    return { isMiniPay, address: null as string | null };
  }
}

function AppLoader() {
  return (
    <main className="lk-loader-screen">
      <section className="lk-loader-panel">
        <div className="lk-loader-knight-wrap" aria-hidden>
          <span className="lk-loader-knight lk-loader-knight-back">♞</span>
          <span className="lk-loader-knight lk-loader-knight-front">♞</span>
        </div>
        <h1 className="lk-loader-title">LittleKnights</h1>
        <p className="lk-loader-copy">Preparing your board, wallet, and match services...</p>
      </section>
    </main>
  );
}
