import { Chess } from "chess.js";
import type { GameMode, GameRoomState, PieceColor } from "../types/game.js";
import { redis } from "./redis.service.js";

const ROOM_KEY_PREFIX = "lk:room:";
const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function roomKey(roomId: string): string {
  return `${ROOM_KEY_PREFIX}${roomId}`;
}

export function buildChess(fen: string): Chess {
  return new Chess(fen);
}

function normalizeFen(fen: string): string {
  try {
    return new Chess(fen).fen();
  } catch {
    return START_FEN;
  }
}

export async function getRoom(roomId: string): Promise<GameRoomState | null> {
  const value = await redis.get(roomKey(roomId));
  if (!value) {
    return null;
  }

  const room = JSON.parse(value) as GameRoomState;
  const normalizedFen = normalizeFen(room.fen);

  if (room.fen !== normalizedFen) {
    const normalizedRoom: GameRoomState = { ...room, fen: normalizedFen };
    await redis.set(roomKey(roomId), JSON.stringify(normalizedRoom));
    return normalizedRoom;
  }

  return room;
}

export async function getOrCreateRoom(roomId: string, mode: GameMode): Promise<GameRoomState> {
  const existing = await getRoom(roomId);
  if (existing) {
    return existing;
  }

  const created: GameRoomState = { id: roomId, mode, fen: START_FEN };
  await redis.set(roomKey(roomId), JSON.stringify(created));
  return created;
}

export async function saveRoom(room: GameRoomState): Promise<void> {
  await redis.set(roomKey(room.id), JSON.stringify(room));
}

export async function deleteRoom(roomId: string): Promise<void> {
  await redis.del(roomKey(roomId));
}

export function assignColor(mode: GameMode, usedColors: PieceColor[]): PieceColor | null {
  if (mode === "single") {
    return "w";
  }

  if (!usedColors.includes("w")) {
    return "w";
  }

  if (!usedColors.includes("b")) {
    return "b";
  }

  return null;
}
