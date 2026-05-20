import type { WebSocket } from "ws";
import type { WsMeta } from "./game.js";

export type ManagedWebSocket = WebSocket & {
  meta?: WsMeta;
};
