import MultiplayerChessGame from "~/components/multiplayerChessGame";
import type { Route } from "./+types/multiplayer.room";

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `Multiplayer ${params.roomId} | Little Knights` }];
}

export default function MultiplayerRoomRoute({ params }: Route.ComponentProps) {
  return <MultiplayerChessGame roomId={params.roomId} title={`Multiplayer ${params.roomId}`} />;
}
