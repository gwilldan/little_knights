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
    <main className="lk-menu-screen flex flex-col items-center justify-center">
      <section className="lk-menu-panel">
        <h1 className="lk-menu-title">Little Knights</h1>

        <nav className="lk-menu-buttons" aria-label="Main menu">
          <Link className="lk-menu-button" to="/single/play">
            One Player
          </Link>
          <Link className="lk-menu-button" to="/multiplayer/room-1">
            Two Players
          </Link>
          <Link className="lk-menu-button" to="/options">
            Options
          </Link>
        </nav>
      </section>

      <aside className="lk-menu-piece" aria-hidden  >
        <p className="text-[200px] leading-25">♞</p>
      </aside>
    </main>
  );
}
