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
    <main className="lk-menu-screen main_background">
      <section className="lk-single-panel">
        <h1 className="lk-single-title">Profile</h1>
        <p className="lk-single-sub">Your player information and quick access settings.</p>

        <section className="lk-profile-card" aria-label="Profile details">
          <p className="lk-profile-line">
            Wallet: <span>{walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "Not connected"}</span>
          </p>
          <p className="lk-profile-line">
            MiniPay: <span>{isMiniPay ? "Detected" : "Not detected"}</span>
          </p>
          <p className="lk-profile-line">
            Server: <span>{healthOk ? "Connected" : "Unavailable"}</span>
          </p>
          <p className="lk-profile-line">
            Games created: <span>{gameCount}</span>
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
