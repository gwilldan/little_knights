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
    <main
      className="lk-app-background flex min-h-dvh flex-col items-center justify-center p-6"
    >
      <section className="mx-auto w-[min(92vw,430px)]">
        <h1
          className="mb-5 mt-0 uppercase font-extrabold tracking-[0.04em] text-[#ebcc8b]"
          style={{
            fontSize: "clamp(3rem, 10vw, 6rem)",
            textShadow: "0 2px 0 #8f5f2a, 0 8px 20px rgba(0, 0, 0, 0.4)",
          }}
        >
          Little Knights
        </h1>

        <nav className="mx-auto flex w-full max-w-105 flex-col items-center gap-4" aria-label="Main menu">
          <Link className="lk-menu-button" to="/single/play">
            One Player
          </Link>
          <Link className="lk-menu-button" to="/multiplayer/room-1">
            Two Players
          </Link>
          <Link className="lk-menu-button z-30" to="/profile">
            Profile
          </Link>
        </nav>
        <div className="mt-2 flex items-center justify-center">
          <p className="m-0 -mt-7 text-[200px] leading-none text-[#f5f5f5] drop-shadow-[0_6px_14px_rgba(0,0,0,0.3)]">♞</p>
        </div>
      </section>
    </main>
  );
}
