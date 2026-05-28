import { Chess } from "chess.js";
import { eq } from "drizzle-orm";
import { isAddress } from "viem";
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
import { writeResolve } from "../../utils/onchain-helpers/contract.helpers";
import { walletClient } from "../../utils/onchain-helpers/viem.init";
import { logAppEvent, shortId } from "../../utils/appLogger";

type HandlerDeps = {
  normalizeMode: (value: string) => GameMode;
};

const roomClients = new Map<string, Map<string, SocketClient>>();
const roomTurnTimeouts = new Map<string, NodeJS.Timeout>();
const roomDisconnectTimeouts = new Map<string, NodeJS.Timeout>();
const roomResolveRetryTimeouts = new Map<string, NodeJS.Timeout>();

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return message.replace(/0x[a-fA-F0-9]{16,}/g, (match) => shortId(match) ?? match);
}

function logInfo(_event: string, _details: Record<string, unknown> = {}) {}
function logWarn(_event: string, _details: Record<string, unknown> = {}) {}
function logError(_event: string, _details: Record<string, unknown> = {}) {}

function roomDetails(room: GameRoomState) {
  return {
    roomId: shortId(room.id),
    mode: room.mode,
    winner: room.winner,
    endReason: room.endReason,
    turn: new Chess(room.fen).turn(),
    whiteMs: Math.max(0, Math.round(room.whiteMs)),
    blackMs: Math.max(0, Math.round(room.blackMs))
  };
}

function recordCapture(room: GameRoomState, move: { color: string; captured?: string }): GameRoomState {
  if (!move.captured) {
    return room;
  }

  if (move.color === "w") {
    return {
      ...room,
      capturedByWhite: [...room.capturedByWhite, move.captured]
    };
  }

  return {
    ...room,
    capturedByBlack: [...room.capturedByBlack, move.captured]
  };
}

async function resolveGameRecord(roomId: string, winner: PieceColor | null): Promise<void> {
  await db
    .update(gamesTable)
    .set({ stop_time: new Date(), game_status: "finsihed" })
    .where(eq(gamesTable.id, roomId));
  logAppEvent("game_resolved_db", { roomId: shortId(roomId), winner: winner ?? "draw" });
}

async function resolveGameOnContract(room: GameRoomState): Promise<void> {
  const winnerAddress =
    room.winner === "w"
      ? room.player1_id
      : room.winner === "b"
        ? room.player2_id
        : "0x0000000000000000000000000000000000000000";

  if (!winnerAddress || !isAddress(winnerAddress)) {
    throw new Error("Cannot resolve game: winner address is not configured.");
  }

  const tx = await writeResolve(room.id as `0x${string}`, winnerAddress);
  if (!tx) {
    throw new Error("Resolve transaction did not return a hash.");
  }

  logAppEvent("game_resolved_contract", {
    roomId: shortId(room.id),
    winner: room.winner ?? "draw",
    txHash: shortId(tx)
  });
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
    logInfo("turn_timeout_cleared", { roomId: shortId(roomId) });
  }
}

function clearDisconnectTimeout(roomId: string) {
  const timeout = roomDisconnectTimeouts.get(roomId);
  if (timeout) {
    clearTimeout(timeout);
    roomDisconnectTimeouts.delete(roomId);
    logInfo("disconnect_timeout_cleared", { roomId: shortId(roomId) });
  }
}

function clearResolveRetryTimeout(roomId: string) {
  const timeout = roomResolveRetryTimeouts.get(roomId);
  if (timeout) {
    clearTimeout(timeout);
    roomResolveRetryTimeouts.delete(roomId);
    logInfo("resolve_retry_cleared", { roomId: shortId(roomId) });
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
  logInfo("settle_started", roomDetails(room));

  await saveRoom(room);

  let onchainResolved = false;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await resolveGameOnContract(room);
      onchainResolved = true;
      break;
    } catch (error) {
      logError("onchain_resolve_failed", {
        roomId: shortId(roomId),
        attempt,
        error: errorMessage(error)
      });
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
      }
    }
  }

  if (onchainResolved) {
    clearResolveRetryTimeout(roomId);
    try {
      await resolveGameRecord(roomId, room.winner);
    } catch (error) {
      logError("game_record_resolve_failed", {
        roomId: shortId(roomId),
        error: errorMessage(error)
      });
    }
  } else {
    scheduleResolveRetry(roomId);
  }

  await broadcastRoom(roomId);
  emitGameEnded(room);
  clearRoomTimeout(roomId);
  clearDisconnectTimeout(roomId);

  logInfo("settle_completed", {
    ...roomDetails(room),
    onchainResolved
  });
}

function scheduleResolveRetry(roomId: string) {
  clearResolveRetryTimeout(roomId);
  const retryMs = 30_000;
  logError("settle_deferred_onchain_unresolved", {
    roomId: shortId(roomId),
    retryMs
  });

  const timeout = setTimeout(async () => {
    roomResolveRetryTimeouts.delete(roomId);
    const latest = await getRoom(roomId);
    if (!latest?.winner) {
      logWarn("resolve_retry_skipped", {
        roomId: shortId(roomId),
        reason: latest ? "game_not_finished" : "missing_room"
      });
      return;
    }

    logWarn("resolve_retry_started", roomDetails(latest));
    await settleFinishedGame(roomId, latest);
  }, retryMs);

  roomResolveRetryTimeouts.set(roomId, timeout);
}

function scheduleRoomTimeout(room: GameRoomState) {
  clearRoomTimeout(room.id);
  if (room.winner || room.activeTurnStartedAt === null) {
    return;
  }

  const remainingMs = Math.max(1, getCurrentTurnMs(room));
  logInfo("turn_timeout_scheduled", {
    roomId: shortId(room.id),
    mode: room.mode,
    remainingMs
  });
  const timeout = setTimeout(async () => {
    const latest = await getRoom(room.id);
    if (!latest) {
      logWarn("turn_timeout_room_missing", { roomId: shortId(room.id) });
      return;
    }

    const next = applyClockTick(latest);
    if (!next.winner) {
      logInfo("turn_timeout_rescheduled", roomDetails(next));
      await saveRoom(next);
      scheduleRoomTimeout(next);
      return;
    }

    logInfo("turn_timeout_triggered", roomDetails(next));
    await settleFinishedGame(room.id, next);
  }, remainingMs);

  roomTurnTimeouts.set(room.id, timeout);
}

function scheduleSingleDisconnectTimeout(room: GameRoomState) {
  clearDisconnectTimeout(room.id);
  clearRoomTimeout(room.id);

  if (room.mode !== "single" || room.winner) {
    return;
  }

  const remainingMs = Math.max(1, getCurrentTurnMs(room));
  logWarn("single_disconnect_timeout_scheduled", {
    roomId: shortId(room.id),
    remainingMs
  });
  const timeout = setTimeout(async () => {
    roomDisconnectTimeouts.delete(room.id);

    const clients = getClients(room.id);
    if (clients.size > 0) {
      logInfo("single_disconnect_timeout_cancelled_active_client", { roomId: shortId(room.id) });
      return;
    }

    const latest = await getRoom(room.id);
    if (!latest || latest.mode !== "single" || latest.winner) {
      logWarn("single_disconnect_timeout_skipped", {
        roomId: shortId(room.id),
        reason: !latest ? "missing_room" : latest.winner ? "already_finished" : "not_single"
      });
      return;
    }

    const timedOut = applyClockTick(latest);
    const next = withGameResult(
      {
        ...timedOut,
        whiteMs: 0
      },
      "timeout",
      "b"
    );

    logWarn("single_disconnect_timeout_triggered", roomDetails(next));
    await settleFinishedGame(room.id, next);
  }, remainingMs + 50);

  roomDisconnectTimeouts.set(room.id, timeout);
}

async function broadcastRoom(roomId: string): Promise<void> {
  const loaded = await getRoom(roomId);
  if (!loaded) {
    logWarn("broadcast_skipped_room_missing", { roomId: shortId(roomId) });
    return;
  }

  const room = applyClockTick(loaded);
  if (JSON.stringify(room) !== JSON.stringify(loaded)) {
    await saveRoom(room);
  }

  const clients = getClients(roomId);
  const snapshot = buildSnapshot(room);
  logInfo("snapshot_broadcast", {
    roomId: shortId(roomId),
    clients: clients.size,
    isGameOver: snapshot.isGameOver,
    capturedByWhite: snapshot.capturedByWhite.length,
    capturedByBlack: snapshot.capturedByBlack.length
  });

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
    logWarn("auth_failed_missing_session", { uid: shortId(uid) });
    sendJson(ws, { type: "error", message: "Unauthorized" });
    return false;
  }

  if (ws.authUserId !== uid) {
    logWarn("auth_failed_session_mismatch", { uid: shortId(uid) });
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

  const { roomId, uid, mode, player2_id } = message;
  logInfo("join_received", {
    roomId: shortId(roomId),
    uid: shortId(uid),
    mode
  });

  if (!requireAuth(ws, uid)) {
    return;
  }

  if (!roomId || !uid || !mode) {
    logWarn("join_rejected_invalid_payload", { roomId: shortId(roomId), uid: shortId(uid) });
    sendJson(ws, { type: "error", message: "Invalid join payload." });
    return;
  }

  const normalizedMode = deps.normalizeMode(mode);
  if (normalizedMode === "single") {
    const open = await isSingleGameOpen(roomId);
    if (!open) {
      logWarn("join_rejected_single_game_not_open", { roomId: shortId(roomId), uid: shortId(uid) });
      sendJson(ws, { type: "error", message: "Game is not open on contract." });
      return;
    }
  }

  const loaded = await getOrCreateRoom(roomId, normalizedMode, uid, player2_id);
  const room = applyClockTick(loaded);

  if (room.mode !== normalizedMode) {
    logWarn("join_rejected_mode_mismatch", {
      roomId: shortId(roomId),
      requestedMode: normalizedMode,
      roomMode: room.mode
    });
    sendJson(ws, { type: "error", message: "Room mode mismatch." });
    return;
  }

  if (room.winner) {
    logWarn("join_rejected_game_over", roomDetails(room));
    await settleFinishedGame(roomId, room);
    sendJson(ws, { type: "error", message: "Game is over." });
    return;
  }

  const color = assignColor(room, uid);
  if (!color) {
    logWarn("join_rejected_room_full", { roomId: shortId(roomId), uid: shortId(uid) });
    sendJson(ws, { type: "error", message: "Room is full." });
    return;
  }

  room.players[uid] = color;
  await saveRoom(room);

  const clients = getClients(roomId);
  clearDisconnectTimeout(roomId);
  clients.set(uid, { uid, color, ws });
  ws.meta = { roomId, uid };
  logInfo("client_joined_room", {
    roomId: shortId(roomId),
    uid: shortId(uid),
    color,
    clients: clients.size
  });

  await broadcastRoom(roomId);
  scheduleRoomTimeout(room);
}

async function handleMove(ws: ManagedWebSocket, message: MoveMessage): Promise<void> {
  const { roomId, uid, from, to, promotion } = message;
  logInfo("move_received", {
    roomId: shortId(roomId),
    uid: shortId(uid),
    from,
    to
  });

  if (!requireAuth(ws, uid)) {
    return;
  }

  const loaded = await getRoom(roomId);

  if (!loaded) {
    logWarn("move_rejected_room_missing", { roomId: shortId(roomId), uid: shortId(uid) });
    sendJson(ws, { type: "error", message: "Room not found." });
    return;
  }

  let room = applyClockTick(loaded);
  if (room.winner) {
    logWarn("move_rejected_game_over", roomDetails(room));
    await settleFinishedGame(roomId, room);
    sendJson(ws, { type: "error", message: "Game is over." });
    return;
  }

  const color = room.players[uid];
  if (!color) {
    logWarn("move_rejected_not_in_room", { roomId: shortId(roomId), uid: shortId(uid) });
    sendJson(ws, { type: "error", message: "Not in room." });
    return;
  }

  const chess = new Chess(room.fen);

  if (chess.turn() !== color) {
    logWarn("move_rejected_wrong_turn", {
      roomId: shortId(roomId),
      uid: shortId(uid),
      expectedTurn: chess.turn(),
      color
    });
    sendJson(ws, { type: "error", message: "Not your turn." });
    return;
  }

  const applied = chess.move({ from, to, promotion: promotion || "q" });
  if (!applied) {
    logWarn("move_rejected_illegal", { roomId: shortId(roomId), uid: shortId(uid), from, to });
    sendJson(ws, { type: "error", message: "Illegal move." });
    return;
  }

  room = recordCapture(room, applied);
  logInfo("move_applied", {
    roomId: shortId(roomId),
    uid: shortId(uid),
    color,
    from,
    to,
    captured: applied.captured ?? null
  });

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
      const appliedAiMove = aiChess.move(aiMove);
      if (appliedAiMove) {
        room = recordCapture(room, appliedAiMove);
        logInfo("bot_move_applied", {
          roomId: shortId(roomId),
          from: appliedAiMove.from,
          to: appliedAiMove.to,
          captured: appliedAiMove.captured ?? null
        });
      }
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
    logInfo("move_finished_game", roomDetails(room));
    await settleFinishedGame(roomId, room);
    return;
  }

  await saveRoom(room);
  await broadcastRoom(roomId);
  scheduleRoomTimeout(room);
}

async function handleNewGame(ws: ManagedWebSocket, roomId: string, uid: string, init_tx: string): Promise<void> {
  logInfo("new_game_received", {
    roomId: shortId(roomId),
    uid: shortId(uid),
    hasTransaction: Boolean(init_tx)
  });

  if (!requireAuth(ws, uid)) {
    return;
  }

  const  txReceipt = await walletClient.getTransactionReceipt({ hash: init_tx as `0x${string}` })
  logInfo("new_game_transaction_checked", {
    roomId: shortId(roomId),
    uid: shortId(uid),
    status: txReceipt?.status ?? "missing"
  });
  if (!txReceipt || txReceipt.status !== "success") {
    logWarn("new_game_rejected_invalid_transaction", { roomId: shortId(roomId), uid: shortId(uid) });
    sendJson(ws, { type: "error", message: "Invalid transaction." });
    return;
  }

  const room = await getRoom(roomId);
  if (!room) {
    logWarn("new_game_rejected_room_missing", { roomId: shortId(roomId), uid: shortId(uid) });
    sendJson(ws, { type: "error", message: "Room not found." });
    return;
  }

  if (!room.players[uid]) {
    logWarn("new_game_rejected_not_in_room", { roomId: shortId(roomId), uid: shortId(uid) });
    sendJson(ws, { type: "error", message: "Not in room." });
    return;
  }

  await saveRoom(resetGameState(room));
  logInfo("new_game_started", { roomId: shortId(roomId), uid: shortId(uid) });
  await broadcastRoom(roomId);
  const updated = await getRoom(roomId);
  if (updated) {
    scheduleRoomTimeout(updated);
  }
}

async function handleForfeit(ws: ManagedWebSocket, roomId: string, uid: string): Promise<void> {
  logWarn("forfeit_received", {
    roomId: shortId(roomId),
    uid: shortId(uid)
  });

  if (!requireAuth(ws, uid)) {
    return;
  }

  const loaded = await getRoom(roomId);
  if (!loaded) {
    logWarn("forfeit_rejected_room_missing", { roomId: shortId(roomId), uid: shortId(uid) });
    sendJson(ws, { type: "error", message: "Room not found." });
    return;
  }

  const room = applyClockTick(loaded);
  if (room.mode !== "single") {
    logWarn("forfeit_rejected_not_single", { roomId: shortId(roomId), uid: shortId(uid), mode: room.mode });
    sendJson(ws, { type: "error", message: "Forfeit is only available for single games." });
    return;
  }

  if (!room.players[uid]) {
    logWarn("forfeit_rejected_not_in_room", { roomId: shortId(roomId), uid: shortId(uid) });
    sendJson(ws, { type: "error", message: "Not in room." });
    return;
  }

  if (room.winner) {
    logWarn("forfeit_rejected_game_over", roomDetails(room));
    await settleFinishedGame(roomId, room);
    return;
  }

  const forfeitedRoom = withGameResult(
    {
      ...room,
      whiteMs: 0
    },
    "forfeit",
    "b"
  );

  logWarn("single_game_forfeited", roomDetails(forfeitedRoom));
  await settleFinishedGame(roomId, forfeitedRoom);
}

export async function onSocketMessage(ws: ManagedWebSocket, raw: unknown, deps: HandlerDeps): Promise<void> {
  let parsed: InboundMessage;

  try {
    parsed = JSON.parse(String(raw)) as InboundMessage;
  } catch {
    logWarn("message_rejected_invalid_json");
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
    await handleNewGame(ws, parsed.roomId, parsed.uid, parsed.init_tx);
    return;
  }

  if (parsed.type === "forfeit") {
    await handleForfeit(ws, parsed.roomId, parsed.uid);
    return;
  }

  logWarn("message_rejected_unknown_type", {
    type: (parsed as { type?: unknown }).type
  });
  sendJson(ws, { type: "error", message: "Unknown message type." });
}

export async function onSocketClose(ws: ManagedWebSocket): Promise<void> {
  if (!ws.meta) {
    logInfo("socket_closed_without_room");
    return;
  }

  const clients = getClients(ws.meta.roomId);
  clients.delete(ws.meta.uid);
  logInfo("socket_closed", {
    roomId: shortId(ws.meta.roomId),
    uid: shortId(ws.meta.uid),
    remainingClients: clients.size
  });

  if (clients.size === 0) {
    const room = await getRoom(ws.meta.roomId);
    roomClients.delete(ws.meta.roomId);
    if (room?.mode === "single" && !room.winner) {
      scheduleSingleDisconnectTimeout(room);
      return;
    }
    clearRoomTimeout(ws.meta.roomId);
    clearDisconnectTimeout(ws.meta.roomId);
  }

  // Persisted Redis room state remains intact for reconnect/resume.
}
