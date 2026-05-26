import { Link } from "react-router";
import type { Route } from "./+types/profile";
import { useAppSession } from "~/utils/app-session";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Profile | Little Knights" },
    { name: "description", content: "View your profile and app options." },
  ];
}

export default function ProfileRoute() {
  const { walletAddress, isMiniPay, healthOk, gameCount } = useAppSession();

  return (
    <main className="lk-app-background flex min-h-dvh items-center justify-center p-6">
      <section className="lk-single-panel">
        <h1 className="lk-single-title">Profile</h1>
        <p className="lk-single-sub">Your player information and quick access settings.</p>

        <section className="mt-5 rounded-2xl border border-[#e4c189]/35 bg-[#1e120c]/80 p-4" aria-label="Profile details">
          <p className="mb-0 mt-2 text-xs text-[#d5b07c]">
            Wallet: <span className="font-semibold text-[#f4dfbc]">{walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "Not connected"}</span>
          </p>
          <p className="mb-0 mt-2 text-xs text-[#d5b07c]">
            MiniPay: <span className="font-semibold text-[#f4dfbc]">{isMiniPay ? "Detected" : "Not detected"}</span>
          </p>
          <p className="mb-0 mt-2 text-xs text-[#d5b07c]">
            Server: <span className="font-semibold text-[#f4dfbc]">{healthOk ? "Connected" : "Unavailable"}</span>
          </p>
          <p className="mb-0 mt-2 text-xs text-[#d5b07c]">
            USDC Bal: <span className="font-semibold text-[#f4dfbc]">$ {gameCount}</span>
          </p>
        </section>

        <div className="lk-single-actions">
          <Link className="lk-menu-button" to="/options">
            Options
          </Link>
          <Link className="lk-single-exit" to="/">
            Back Home
          </Link>
        </div>
      </section>
    </main>
  );
}
