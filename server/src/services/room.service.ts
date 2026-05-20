import { Chess } from "chess.js";
import type { GameMode, GameRoom, PieceColor } from "../types/game.js";

const rooms = new Map<string, GameRoom>();

export function getRoom(roomId: string): GameRoom | undefined {
  return rooms.get(roomId);
}

export function getOrCreateRoom(roomId: string, mode: GameMode): GameRoom {
  const existing = rooms.get(roomId);
  if (existing) {
    return existing;
  }

  const created: GameRoom = {
    id: roomId,
    mode,
    chess: new Chess(),
    clients: new Map()
  };

  rooms.set(roomId, created);
  return created;
}

export function deleteRoom(roomId: string): boolean {
  return rooms.delete(roomId);
}

export function assignColor(room: GameRoom): PieceColor | null {
  if (room.mode === "single") {
    return "w";
  }

  const used = new Set(Array.from(room.clients.values()).map((client) => client.color));

  if (!used.has("w")) {
    return "w";
  }

  if (!used.has("b")) {
    return "b";
  }

  return null;
}
