import { Link } from "react-router";
import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Little Knights" },
    { name: "description", content: "Choose your chess mode." },
  ];
}

export default function Home() {
  return (
    <main className="lk-menu-screen main_background">
      <section className="lk-menu-panel">
        <h1 className="lk-menu-title">Little Knights</h1>

        <nav className="lk-menu-buttons" aria-label="Main menu">
          <Link className="lk-menu-button" to="/single">
            One Player
          </Link>
          <Link className="lk-menu-button" to="/multiplayer/room-1">
            Two Players
          </Link>
          <Link className="lk-menu-button" to="/profile">
            Profile
          </Link>
        </nav>
        <div className="lk-menu-knight-wrap" aria-hidden>
          <p className="lk-menu-knight text-[200px] leading-15">♞</p>
        </div>
      </section>
    </main>
  );
}
