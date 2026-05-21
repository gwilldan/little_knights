import { Chess } from "chess.js";
import type { GameMode, InboundMessage, MoveMessage, SocketClient } from "../../types/game.js";
import type { ManagedWebSocket } from "../../types/ws.js";
import { selectBestMove } from "../../services/chessEngine.service.js";
import {
  applyClockTick,
  assignColor,
  getOrCreateRoom,
  getRoom,
  resetGameState,
  resetTurnClocks,
  saveRoom,
  withGameResult
} from "../../services/room.service.js";
import { buildSnapshot } from "../../utils/gameSnapshot.js";
import { sendJson } from "../../utils/socket.js";

type HandlerDeps = {
  normalizeMode: (value: string) => GameMode;
};

const roomClients = new Map<string, Map<string, SocketClient>>();

function getClients(roomId: string): Map<string, SocketClient> {
  const existing = roomClients.get(roomId);
  if (existing) {
    return existing;
  }

  const created = new Map<string, SocketClient>();
  roomClients.set(roomId, created);
  return created;
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

async function handleJoin(ws: ManagedWebSocket, message: InboundMessage, deps: HandlerDeps): Promise<void> {
  if (message.type !== "join") {
    sendJson(ws, { type: "error", message: "Invalid join payload." });
    return;
  }

  const { roomId, uid, mode } = message;

  if (!roomId || !uid || !mode) {
    sendJson(ws, { type: "error", message: "Invalid join payload." });
    return;
  }

  const normalizedMode = deps.normalizeMode(mode);
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
}

async function handleMove(ws: ManagedWebSocket, message: MoveMessage): Promise<void> {
  const { roomId, uid, from, to, promotion } = message;
  const loaded = await getRoom(roomId);

  if (!loaded) {
    sendJson(ws, { type: "error", message: "Room not found." });
    return;
  }

  let room = applyClockTick(loaded);
  if (room.winner) {
    await saveRoom(room);
    await broadcastRoom(roomId);
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
      await saveRoom(room);
      await broadcastRoom(roomId);
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

  await saveRoom(room);
  await broadcastRoom(roomId);
}

async function handleNewGame(ws: ManagedWebSocket, roomId: string, uid: string): Promise<void> {
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
  }

  // Persisted Redis room state remains intact for reconnect/resume.
}
