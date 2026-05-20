import type { ManagedWebSocket } from "../../types/ws.js";
import type { GameRoom, InboundMessage, MoveMessage } from "../../types/game.js";
import { sendJson } from "../../utils/socket.js";
import { buildSnapshot } from "../../utils/gameSnapshot.js";
import { assignColor, deleteRoom, getOrCreateRoom, getRoom } from "../../services/room.service.js";
import { selectBestMove } from "../../services/chessAi.service.js";

type HandlerDeps = {
  normalizeMode: (value: string) => "single" | "multiplayer";
};

function broadcastRoom(room: GameRoom): void {
  const snapshot = buildSnapshot(room);

  for (const client of room.clients.values()) {
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

function handleJoin(ws: ManagedWebSocket, message: InboundMessage, deps: HandlerDeps): void {
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
  const room = getOrCreateRoom(roomId, normalizedMode);

  if (room.mode !== normalizedMode) {
    sendJson(ws, { type: "error", message: "Room mode mismatch." });
    return;
  }

  const color = assignColor(room);
  if (!color) {
    sendJson(ws, { type: "error", message: "Room is full." });
    return;
  }

  room.clients.set(uid, { uid, color, ws });
  ws.meta = { roomId, uid };
  broadcastRoom(room);
}

function handleMove(ws: ManagedWebSocket, message: MoveMessage): void {
  const { roomId, uid, from, to, promotion } = message;
  const room = getRoom(roomId);

  if (!room) {
    sendJson(ws, { type: "error", message: "Room not found." });
    return;
  }

  const player = room.clients.get(uid);
  if (!player) {
    sendJson(ws, { type: "error", message: "Not in room." });
    return;
  }

  if (room.chess.turn() !== player.color) {
    sendJson(ws, { type: "error", message: "Not your turn." });
    return;
  }

  const applied = room.chess.move({ from, to, promotion: promotion || "q" });
  if (!applied) {
    sendJson(ws, { type: "error", message: "Illegal move." });
    return;
  }

  if (room.mode === "single" && !room.chess.isGameOver()) {
    const aiMove = selectBestMove(room.chess, 3);
    if (aiMove) {
      room.chess.move(aiMove);
    }
  }

  broadcastRoom(room);
}

export function onSocketMessage(ws: ManagedWebSocket, raw: unknown, deps: HandlerDeps): void {
  let parsed: InboundMessage;

  try {
    parsed = JSON.parse(String(raw)) as InboundMessage;
  } catch {
    sendJson(ws, { type: "error", message: "Invalid JSON." });
    return;
  }

  if (parsed.type === "join") {
    handleJoin(ws, parsed, deps);
    return;
  }

  if (parsed.type === "move") {
    handleMove(ws, parsed);
    return;
  }

  sendJson(ws, { type: "error", message: "Unknown message type." });
}

export function onSocketClose(ws: ManagedWebSocket): void {
  if (!ws.meta) {
    return;
  }

  const room = getRoom(ws.meta.roomId);
  if (!room) {
    return;
  }

  room.clients.delete(ws.meta.uid);

  if (room.clients.size === 0) {
    deleteRoom(ws.meta.roomId);
    return;
  }

  broadcastRoom(room);
}
