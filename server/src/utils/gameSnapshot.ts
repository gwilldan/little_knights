import { Chess } from "chess.js";
import type { GameRoomState, SnapshotMessage } from "../types/game";
import { applyClockTick } from "../services/room.service";

export function buildSnapshot(room: GameRoomState): SnapshotMessage {
  const effectiveRoom = applyClockTick(room);
  const chess = new Chess(effectiveRoom.fen);

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
    legalMoves: legalMoves.map((move) => ({
      from: move.from,
      to: move.to,
      promotion: move.promotion || ""
    })),
    capturedByWhite: effectiveRoom.capturedByWhite,
    capturedByBlack: effectiveRoom.capturedByBlack,
    whiteMs: Math.max(0, effectiveRoom.whiteMs),
    blackMs: Math.max(0, effectiveRoom.blackMs),
    winner: effectiveRoom.winner,
    endReason: effectiveRoom.endReason,
    serverNow: Date.now()
  };
}
