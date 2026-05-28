import { Chess } from "chess.js";
import type { GameEndReason, GameMode, GameRoomState, PieceColor } from "../types/game";
import { redis } from "./redis.service";

const BOT_WALLET_ADDRESS = process.env.BOT_WALLET_ADDRESS as string;

const ROOM_KEY_PREFIX = "lk:room:";
const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const TURN_LIMIT_MS = 60_000;

function roomKey(roomId: string): string {
  return `${ROOM_KEY_PREFIX}${roomId}`;
}

function normalizeFen(fen: string): string {
  try {
    return new Chess(fen).fen();
  } catch {
    return START_FEN;
  }
}

function normalizeRoom(room: Partial<GameRoomState>): GameRoomState {
  return {
    id: room.id ?? "",
    mode: room.mode ?? "single",
    fen: normalizeFen(room.fen ?? START_FEN),
    players: room.players ?? {},
    whiteMs: typeof room.whiteMs === "number" ? room.whiteMs : TURN_LIMIT_MS,
    blackMs: typeof room.blackMs === "number" ? room.blackMs : TURN_LIMIT_MS,
    activeTurnStartedAt: typeof room.activeTurnStartedAt === "number" ? room.activeTurnStartedAt : Date.now(),
    winner: room.winner ?? null,
    endReason: room.endReason ?? null,
    capturedByWhite: Array.isArray(room.capturedByWhite) ? room.capturedByWhite : [],
    capturedByBlack: Array.isArray(room.capturedByBlack) ? room.capturedByBlack : [],
    player1_id: room.player1_id!,
    player2_id: room.player2_id ?? BOT_WALLET_ADDRESS
  };
}

function markTimeoutIfNeeded(room: GameRoomState): GameRoomState {
  if (room.winner || !room.activeTurnStartedAt) {
    return room;
  }

  const chess = new Chess(room.fen);
  const turn = chess.turn();

  if ((turn === "w" && room.whiteMs <= 0) || (turn === "b" && room.blackMs <= 0)) {
    return {
      ...room,
      whiteMs: Math.max(0, room.whiteMs),
      blackMs: Math.max(0, room.blackMs),
      winner: turn === "w" ? "b" : "w",
      endReason: "timeout",
      activeTurnStartedAt: null
    };
  }

  return room;
}

export function applyClockTick(room: GameRoomState, now = Date.now()): GameRoomState {
  if (room.winner || room.activeTurnStartedAt === null) {
    return room;
  }

  const chess = new Chess(room.fen);
  const turn = chess.turn();
  const elapsed = Math.max(0, now - room.activeTurnStartedAt);

  const next: GameRoomState = {
    ...room,
    whiteMs: turn === "w" ? room.whiteMs - elapsed : room.whiteMs,
    blackMs: turn === "b" ? room.blackMs - elapsed : room.blackMs,
    activeTurnStartedAt: now
  };

  return markTimeoutIfNeeded(next);
}

export function withGameResult(room: GameRoomState, reason: GameEndReason, winner: PieceColor | null): GameRoomState {
  return {
    ...room,
    winner,
    endReason: reason,
    activeTurnStartedAt: null
  };
}

export function resetTurnClocks(room: GameRoomState): GameRoomState {
  return {
    ...room,
    whiteMs: TURN_LIMIT_MS,
    blackMs: TURN_LIMIT_MS,
    activeTurnStartedAt: Date.now()
  };
}

export function resetGameState(room: GameRoomState): GameRoomState {
  return {
    ...room,
    fen: START_FEN,
    whiteMs: TURN_LIMIT_MS,
    blackMs: TURN_LIMIT_MS,
    activeTurnStartedAt: Date.now(),
    winner: null,
    endReason: null,
    capturedByWhite: [],
    capturedByBlack: []
  };
}

export async function getRoom(roomId: string): Promise<GameRoomState | null> {
  const value = await redis.get(roomKey(roomId));
  if (!value) {
    return null;
  }

  const parsed = JSON.parse(value) as Partial<GameRoomState>;
  const normalized = normalizeRoom(parsed);

  if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
    await redis.set(roomKey(roomId), JSON.stringify(normalized));
  }

  return normalized;
}

export async function getOrCreateRoom(roomId: string, mode: GameMode, player1_id: string, player2_id: string | null): Promise<GameRoomState> {

  const existing = await getRoom(roomId);
  if (existing) {
    return existing;
  }

  const created: GameRoomState = {
    id: roomId,
    mode,
    fen: START_FEN,
    players: {},
    whiteMs: TURN_LIMIT_MS,
    blackMs: TURN_LIMIT_MS,
    activeTurnStartedAt: Date.now(),
    winner: null,
    endReason: null,
    capturedByWhite: [],
    capturedByBlack: [],
    player1_id: player1_id,
    player2_id: player2_id ?? BOT_WALLET_ADDRESS
  };

  await redis.set(roomKey(roomId), JSON.stringify(created));
  return created;
}

export async function saveRoom(room: GameRoomState): Promise<void> {
  await redis.set(roomKey(room.id), JSON.stringify(room));
}

export function assignColor(room: GameRoomState, uid: string): PieceColor | null {
  const existing = room.players[uid];
  if (existing) {
    return existing;
  }

  if (room.mode === "single") {
    return "w";
  }

  const usedColors = Object.values(room.players);

  if (!usedColors.includes("w")) {
    return "w";
  }

  if (!usedColors.includes("b")) {
    return "b";
  }

  return null;
}
