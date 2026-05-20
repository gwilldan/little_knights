import NetworkChessGame from "~/components/networkChessGame";
import { getOrCreateUid } from "~/utils/user";

export default function ChessGame() {
  const uid = getOrCreateUid();
  const roomId = `single-${uid}`;

  return <NetworkChessGame mode="single" opponentLabel="AI" roomId={roomId} title="Single Player" />;
}
