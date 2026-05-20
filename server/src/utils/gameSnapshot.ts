import type { Chess } from "chess.js";
import type { GameRoom, SnapshotMessage } from "../types/game.js";

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

export function buildSnapshot(room: GameRoom): SnapshotMessage {
  const { capturedByWhite, capturedByBlack } = getCaptured(room.chess);

  const legalMoves = room.chess.moves({ verbose: true }).map((move) => ({
    from: move.from,
    to: move.to,
    promotion: move.promotion
  }));

  return {
    type: "snapshot",
    roomId: room.id,
    mode: room.mode,
    fen: room.chess.fen(),
    turn: room.chess.turn(),
    isGameOver: room.chess.isGameOver(),
    legalMoves,
    capturedByWhite,
    capturedByBlack
  };
}
