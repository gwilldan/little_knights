import { createContext, useContext } from "react";

export type InitStatus = "idle" | "loading" | "ready" | "error";

export type AppSessionState = {
  status: InitStatus;
  walletAddress: string | null;
  isMiniPay: boolean;
  healthOk: boolean;
  gameCount: number;
  lastError: string | null;
  createSingleGame: (betAmount: string) => Promise<{ gameId: string; txHash: string }>;
};

export const AppSessionContext = createContext<AppSessionState | null>(null);

export function useAppSession() {
  const context = useContext(AppSessionContext);

  if (!context) {
    throw new Error("useAppSession must be used within AppSessionContext provider.");
  }

  return context;
}

export function makeGameId(gameCount: number) {
  const stamp = Date.now().toString(36);
  return `sg-${stamp}-${gameCount + 1}`;
}
