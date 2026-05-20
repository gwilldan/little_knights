import { Chess } from "chess.js";
import type { ManagedWebSocket } from "../../types/ws.js";
import type { GameMode, InboundMessage, MoveMessage, PieceColor, SocketClient } from "../../types/game.js";
import { sendJson } from "../../utils/socket.js";
import { buildSnapshot } from "../../utils/gameSnapshot.js";
import { assignColor, deleteRoom, getOrCreateRoom, getRoom, saveRoom } from "../../services/room.service.js";
import { selectBestMove } from "../../services/chessEngine.service.js";

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
  const room = await getRoom(roomId);
  if (!room) {
    return;
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
  const room = await getOrCreateRoom(roomId, normalizedMode);

  if (room.mode !== normalizedMode) {
    sendJson(ws, { type: "error", message: "Room mode mismatch." });
    return;
  }

  const clients = getClients(roomId);
  const usedColors: PieceColor[] = Array.from(clients.values()).map((client) => client.color);
  const color = assignColor(room.mode, usedColors);
  if (!color) {
    sendJson(ws, { type: "error", message: "Room is full." });
    return;
  }

  clients.set(uid, { uid, color, ws });
  ws.meta = { roomId, uid };
  await broadcastRoom(roomId);
}

async function handleMove(ws: ManagedWebSocket, message: MoveMessage): Promise<void> {
  const { roomId, uid, from, to, promotion } = message;
  const room = await getRoom(roomId);

  if (!room) {
    sendJson(ws, { type: "error", message: "Room not found." });
    return;
  }

  const clients = getClients(roomId);
  const player = clients.get(uid);
  if (!player) {
    sendJson(ws, { type: "error", message: "Not in room." });
    return;
  }

  const chess = new Chess(room.fen);

  if (chess.turn() !== player.color) {
    sendJson(ws, { type: "error", message: "Not your turn." });
    return;
  }

  const applied = chess.move({ from, to, promotion: promotion || "q" });
  if (!applied) {
    sendJson(ws, { type: "error", message: "Illegal move." });
    return;
  }

  if (room.mode === "single" && !chess.isGameOver()) {
    const aiMove = selectBestMove(chess, 3);
    if (aiMove) {
      chess.move(aiMove);
    }
  }

  await saveRoom({ ...room, fen: chess.fen() });
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
    await deleteRoom(ws.meta.roomId);
    return;
  }

  await broadcastRoom(ws.meta.roomId);
}
