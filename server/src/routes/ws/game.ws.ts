import type { WebSocketServer } from "ws";
import { onSocketClose, onSocketMessage } from "../../handlers/ws/game.handler.js";
import type { ManagedWebSocket } from "../../types/ws.js";

function normalizeMode(value: string): "single" | "multiplayer" {
  return value === "single" ? "single" : "multiplayer";
}

export function registerGameSocketRoutes(wss: WebSocketServer): void {
  wss.on("connection", (socket) => {
    const ws = socket as ManagedWebSocket;

    ws.on("message", (raw) => {
      onSocketMessage(ws, raw, { normalizeMode });
    });

    ws.on("close", () => {
      onSocketClose(ws);
    });
  });
}
