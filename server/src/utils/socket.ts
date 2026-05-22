import type { ManagedWebSocket } from "../types/ws";
import type { OutboundMessage } from "../types/game";

export function sendJson(ws: ManagedWebSocket, payload: OutboundMessage): boolean {
  if (ws.readyState !== 1) {
    return false;
  }

  ws.send(JSON.stringify(payload));
  return true;
}
