import ChessGame from "~/components/chessGame";
import type { Route } from "./+types/single.play";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Single Player | Little Knights" },
    { name: "description", content: "Play chess against AI." },
  ];
}

export default function SinglePlayRoute() {
  return <ChessGame />;
}
