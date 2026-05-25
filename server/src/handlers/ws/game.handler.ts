import { Chess } from "chess.js";
import { eq } from "drizzle-orm";
import { db } from "../../db/db.init";
import { gamesTable } from "../../db/schema";
import type {
  GameMode,
  GameRoomState,
  InboundMessage,
  MoveMessage,
  PieceColor,
  SocketClient
} from "../../types/game";
import type { ManagedWebSocket } from "../../types/ws";
import { selectBestMove } from "../../services/chessEngine.service";
import {
  applyClockTick,
  assignColor,
  getOrCreateRoom,
  getRoom,
  resetGameState,
  resetTurnClocks,
  saveRoom,
  withGameResult
} from "../../services/room.service";
import { buildSnapshot } from "../../utils/gameSnapshot";
import { sendJson } from "../../utils/socket";

type HandlerDeps = {
  normalizeMode: (value: string) => GameMode;
};

const roomClients = new Map<string, Map<string, SocketClient>>();
const roomTurnTimeouts = new Map<string, NodeJS.Timeout>();

async function resolveGameRecord(roomId: string, winner: PieceColor | null): Promise<void> {
  await db
    .update(gamesTable)
    .set({ stop_time: new Date() })
    .where(eq(gamesTable.id, roomId));
  console.log(`Resolved game record ${roomId} with winner ${winner ?? "draw"}`);
}

async function resolveGameOnContract(roomId: string, winner: PieceColor | null): Promise<void> {
  // Placeholder hook for contract resolution integration.
  // This is called on every terminal game state with the resolved winner.
  console.log(`Resolve on contract requested for ${roomId} winner=${winner ?? "draw"}`);
}

async function isSingleGameOpen(roomId: string): Promise<boolean> {
  const [game] = await db
    .select()
    .from(gamesTable)
    .where(eq(gamesTable.id, roomId))
    .limit(1);

  return Boolean(game && !game.is_multiplayer && game.stop_time === null);
}

function getClients(roomId: string): Map<string, SocketClient> {
  const existing = roomClients.get(roomId);
  if (existing) {
    return existing;
  }

  const created = new Map<string, SocketClient>();
  roomClients.set(roomId, created);
  return created;
}

function clearRoomTimeout(roomId: string) {
  const timeout = roomTurnTimeouts.get(roomId);
  if (timeout) {
    clearTimeout(timeout);
    roomTurnTimeouts.delete(roomId);
  }
}

function getCurrentTurnMs(room: GameRoomState): number {
  const chess = new Chess(room.fen);
  return chess.turn() === "w" ? room.whiteMs : room.blackMs;
}

function emitGameEnded(room: GameRoomState): void {
  if (!room.endReason) return;
  const clients = getClients(room.id);
  for (const client of clients.values()) {
    sendJson(client.ws as ManagedWebSocket, {
      type: "game_end",
      roomId: room.id,
      winner: room.winner,
      endReason: room.endReason
    });
  }
}

async function settleFinishedGame(roomId: string, room: GameRoomState): Promise<void> {
  await resolveGameOnContract(roomId, room.winner);
  await saveRoom(room);
  await resolveGameRecord(roomId, room.winner);
  await broadcastRoom(roomId);
  emitGameEnded(room);
  clearRoomTimeout(roomId);
}

function scheduleRoomTimeout(room: GameRoomState) {
  clearRoomTimeout(room.id);
  if (room.winner || room.activeTurnStartedAt === null) {
    return;
  }

  const remainingMs = Math.max(1, getCurrentTurnMs(room));
  const timeout = setTimeout(async () => {
    const latest = await getRoom(room.id);
    if (!latest) return;

    const next = applyClockTick(latest);
    if (!next.winner) {
      await saveRoom(next);
      scheduleRoomTimeout(next);
      return;
    }

    await settleFinishedGame(room.id, next);
  }, remainingMs + 50);

  roomTurnTimeouts.set(room.id, timeout);
}

async function broadcastRoom(roomId: string): Promise<void> {
  const loaded = await getRoom(roomId);
  if (!loaded) {
    return;
  }

  const room = applyClockTick(loaded);
  if (JSON.stringify(room) !== JSON.stringify(loaded)) {
    await saveRoom(room);
  }

  const clients = getClients(roomId);
  const snapshot = buildSnapshot(room);

  for (const client of clients.values()) {
    sendJson(client.ws as ManagedWebSocket, {
      type: "joined",
      roomId: room.id,
      mode: room.mode,
      color: client.color,
      uid: client.uid
    });
    sendJson(client.ws as ManagedWebSocket, snapshot);
  }
}

function requireAuth(ws: ManagedWebSocket, uid: string): boolean {
  if (!ws.authUserId) {
    sendJson(ws, { type: "error", message: "Unauthorized" });
    return false;
  }

  if (ws.authUserId !== uid) {
    sendJson(ws, { type: "error", message: "Invalid session" });
    return false;
  }

  return true;
}

async function handleJoin(ws: ManagedWebSocket, message: InboundMessage, deps: HandlerDeps): Promise<void> {
  if (message.type !== "join") {
    sendJson(ws, { type: "error", message: "Invalid join payload." });
    return;
  }

  const { roomId, uid, mode } = message;

  if (!requireAuth(ws, uid)) {
    return;
  }

  if (!roomId || !uid || !mode) {
    sendJson(ws, { type: "error", message: "Invalid join payload." });
    return;
  }

  const normalizedMode = deps.normalizeMode(mode);
  if (normalizedMode === "single") {
    const open = await isSingleGameOpen(roomId);
    if (!open) {
      sendJson(ws, { type: "error", message: "Game is not open on contract." });
      return;
    }
  }

  const loaded = await getOrCreateRoom(roomId, normalizedMode);
  const room = applyClockTick(loaded);

  if (room.mode !== normalizedMode) {
    sendJson(ws, { type: "error", message: "Room mode mismatch." });
    return;
  }

  const color = assignColor(room, uid);
  if (!color) {
    sendJson(ws, { type: "error", message: "Room is full." });
    return;
  }

  room.players[uid] = color;
  await saveRoom(room);

  const clients = getClients(roomId);
  clients.set(uid, { uid, color, ws });
  ws.meta = { roomId, uid };

  await broadcastRoom(roomId);
  scheduleRoomTimeout(room);
}

async function handleMove(ws: ManagedWebSocket, message: MoveMessage): Promise<void> {
  const { roomId, uid, from, to, promotion } = message;

  if (!requireAuth(ws, uid)) {
    return;
  }

  const loaded = await getRoom(roomId);

  if (!loaded) {
    sendJson(ws, { type: "error", message: "Room not found." });
    return;
  }

  let room = applyClockTick(loaded);
  if (room.winner) {
    await settleFinishedGame(roomId, room);
    sendJson(ws, { type: "error", message: "Game is over." });
    return;
  }

  const color = room.players[uid];
  if (!color) {
    sendJson(ws, { type: "error", message: "Not in room." });
    return;
  }

  const chess = new Chess(room.fen);

  if (chess.turn() !== color) {
    sendJson(ws, { type: "error", message: "Not your turn." });
    return;
  }

  const applied = chess.move({ from, to, promotion: promotion || "q" });
  if (!applied) {
    sendJson(ws, { type: "error", message: "Illegal move." });
    return;
  }

  room = resetTurnClocks({
    ...room,
    fen: chess.fen()
  });

  if (room.mode === "single" && !chess.isGameOver()) {
    await saveRoom(room);
    await broadcastRoom(roomId);

    const latest = await getRoom(roomId);
    if (!latest) {
      return;
    }

    room = applyClockTick(latest);
    if (room.winner) {
      await settleFinishedGame(roomId, room);
      return;
    }

    const aiChess = new Chess(room.fen);
    const aiMove = selectBestMove(aiChess, 3);
    if (aiMove) {
      aiChess.move(aiMove);
      room = resetTurnClocks({
        ...room,
        fen: aiChess.fen()
      });
    }
    if (aiChess.isGameOver()) {
      if (aiChess.isCheckmate()) {
        const winner = aiChess.turn() === "w" ? "b" : "w";
        room = withGameResult(room, "checkmate", winner);
      } else {
        room = withGameResult(room, "draw", null);
      }
    }
  } else if (chess.isGameOver()) {
    if (chess.isCheckmate()) {
      const winner = chess.turn() === "w" ? "b" : "w";
      room = withGameResult(room, "checkmate", winner);
    } else {
      room = withGameResult(room, "draw", null);
    }
  }

  if (room.winner) {
    await settleFinishedGame(roomId, room);
    return;
  }

  await saveRoom(room);
  await broadcastRoom(roomId);
  scheduleRoomTimeout(room);
}

async function handleNewGame(ws: ManagedWebSocket, roomId: string, uid: string): Promise<void> {
  if (!requireAuth(ws, uid)) {
    return;
  }

  const room = await getRoom(roomId);
  if (!room) {
    sendJson(ws, { type: "error", message: "Room not found." });
    return;
  }

  if (!room.players[uid]) {
    sendJson(ws, { type: "error", message: "Not in room." });
    return;
  }

  await saveRoom(resetGameState(room));
  await broadcastRoom(roomId);
  const updated = await getRoom(roomId);
  if (updated) {
    scheduleRoomTimeout(updated);
  }
}

export async function onSocketMessage(ws: ManagedWebSocket, raw: unknown, deps: HandlerDeps): Promise<void> {
  let parsed: InboundMessage;

  try {
    parsed = JSON.parse(String(raw)) as InboundMessage;
  } catch {
    sendJson(ws, { type: "error", message: "Invalid JSON." });
    return;
  }

  if (parsed.type === "join") {
    await handleJoin(ws, parsed, deps);
    return;
  }

  if (parsed.type === "move") {
    await handleMove(ws, parsed);
    return;
  }

  if (parsed.type === "new_game") {
    await handleNewGame(ws, parsed.roomId, parsed.uid);
    return;
  }

  sendJson(ws, { type: "error", message: "Unknown message type." });
}

export async function onSocketClose(ws: ManagedWebSocket): Promise<void> {
  if (!ws.meta) {
    return;
  }

  const clients = getClients(ws.meta.roomId);
  clients.delete(ws.meta.uid);

  if (clients.size === 0) {
    roomClients.delete(ws.meta.roomId);
    clearRoomTimeout(ws.meta.roomId);
  }

  // Persisted Redis room state remains intact for reconnect/resume.
}
