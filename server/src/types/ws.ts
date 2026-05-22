import type { WebSocket } from "ws";
import type { WsMeta } from "./game";

export type ManagedWebSocket = WebSocket & {
  meta?: WsMeta;
  authUserId?: string | null;
};
