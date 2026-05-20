import { Chess } from "chess.js";
import type { GameRoomState, SnapshotMessage } from "../types/game.js";

function getCaptured(chess: Chess): { capturedByWhite: string[]; capturedByBlack: string[] } {
  const capturedByWhite: string[] = [];
  const capturedByBlack: string[] = [];

  for (const move of chess.history({ verbose: true })) {
    if (!move.captured) {
      continue;
    }

    if (move.color === "w") {
      capturedByWhite.push(move.captured);
    } else {
      capturedByBlack.push(move.captured);
    }
  }

  return { capturedByWhite, capturedByBlack };
}

export function buildSnapshot(room: GameRoomState): SnapshotMessage {
  const chess = new Chess(room.fen);
  const { capturedByWhite, capturedByBlack } = getCaptured(chess);

  const legalMoves = chess.moves({ verbose: true }).map((move) => ({
    from: move.from,
    to: move.to,
    promotion: move.promotion
  }));

  return {
    type: "snapshot",
    roomId: room.id,
    mode: room.mode,
    fen: chess.fen(),
    turn: chess.turn(),
    isGameOver: chess.isGameOver(),
    legalMoves,
    capturedByWhite,
    capturedByBlack
  };
}
