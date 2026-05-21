import { Chess } from "chess.js";
import type { GameRoomState, SnapshotMessage } from "../types/game.js";
import { applyClockTick } from "../services/room.service.js";

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
  const effectiveRoom = applyClockTick(room);
  const chess = new Chess(effectiveRoom.fen);
  const { capturedByWhite, capturedByBlack } = getCaptured(chess);

  const legalMoves = effectiveRoom.winner
    ? []
    : chess.moves({ verbose: true }).map((move) => ({
        from: move.from,
        to: move.to,
        promotion: move.promotion
      }));

  return {
    type: "snapshot",
    roomId: effectiveRoom.id,
    mode: effectiveRoom.mode,
    fen: chess.fen(),
    turn: chess.turn(),
    isGameOver: chess.isGameOver() || Boolean(effectiveRoom.winner),
    legalMoves,
    capturedByWhite,
    capturedByBlack,
    whiteMs: Math.max(0, effectiveRoom.whiteMs),
    blackMs: Math.max(0, effectiveRoom.blackMs),
    winner: effectiveRoom.winner,
    endReason: effectiveRoom.endReason,
    serverNow: Date.now()
  };
}
