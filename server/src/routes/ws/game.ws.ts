import type { WebSocketServer } from "ws";
import { onSocketClose, onSocketMessage } from "../../handlers/ws/game.handler";
import type { ManagedWebSocket } from "../../types/ws";

function normalizeMode(value: string): "single" | "multiplayer" {
  return value === "single" ? "single" : "multiplayer";
}

export function registerGameSocketRoutes(wss: WebSocketServer): void {
  wss.on("connection", (socket) => {
    const ws = socket as ManagedWebSocket;

    ws.on("message", async (raw) => {
      await onSocketMessage(ws, raw, { normalizeMode });
    });

    ws.on("close", async () => {
      await onSocketClose(ws);
    });
  });
}
