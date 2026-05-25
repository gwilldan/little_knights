import { Outlet } from "react-router";
import { useEffect, useMemo, useState } from "react";
import { AppSessionContext, type AppSessionState } from "./utils/app-session";
import { createSingleGame as createSingleGameCall } from "./utils/contract-calls/singleGame";
import { signInUser } from "./utils/auth";
import { API_URL } from "./constants";

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

        if (!walletResult.address) {
          throw new Error("Wallet connection is required.");
        }

        const signedIn = await signInUser({
          id: walletResult.address,
          name: `Player-${walletResult.address.slice(2, 8)}`,
          balance: walletResult.balance,
        });

        if (!signedIn) {
          throw new Error("Server sign-in failed.");
        }

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

        const result = await createSingleGameCall({ walletAddress, betAmount });
        setGameCount((count) => count + 1);
        return result;
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
      <main className="lk-app-background lk-loader-screen">
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
    return { isMiniPay: false, address: null as string | null, balance: "0" };
  }

  const provider = browserWindow.ethereum as {
    isMiniPay?: boolean;
    request?: (args: { method: string }) => Promise<unknown>;
  };

  const isMiniPay = provider.isMiniPay === true;
  if (!provider.request) {
    return { isMiniPay, address: null as string | null, balance: "0" };
  }

  try {
    const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
    const address = accounts[0] ?? null;
    const balance = address
      ? await getNativeBalance(provider.request, address)
      : "0";
    return { isMiniPay, address, balance };
  } catch {
    return { isMiniPay, address: null as string | null, balance: "0" };
  }
}

async function getNativeBalance(
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>,
  address: string
) {
  try {
    const result = (await request({
      method: "eth_getBalance",
      params: [address, "latest"],
    })) as string;

    return BigInt(result).toString();
  } catch {
    return "0";
  }
}

function AppLoader() {
  return (
    <main className="lk-app-background lk-loader-screen">
      <section className="lk-loader-panel">

        <div aria-hidden className="lk-start-loader">
          <span className="lk-start-loader-piece">♞</span>
          <span className="lk-start-loader-ring" />
        </div>
      
        <h1 className="lk-loader-title">LittleKnights</h1>
        <p className="lk-loader-copy">Preparing your board, wallet, and match services...</p>
      </section>
    </main>
  );
}
