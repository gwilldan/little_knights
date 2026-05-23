import NetworkChessGame from "~/components/networkChessGame";
import type { Route } from "./+types/multiplayer.room";

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `Multiplayer ${params.roomId} | Little Knights` }];
}

export default function MultiplayerRoomRoute({ params }: Route.ComponentProps) {
  return (
    <NetworkChessGame
      mode="multiplayer"
      opponentLabel="Opponent"
      roomId={params.roomId}
      title={`Multiplayer ${params.roomId}`}
    />
  );
}
