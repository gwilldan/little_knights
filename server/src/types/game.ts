import type { Chess } from "chess.js";
import type { WebSocket } from "ws";

export type GameMode = "single" | "multiplayer";
export type PieceColor = "w" | "b";

export type WsMeta = {
  roomId: string;
  uid: string;
};

export type SocketClient = {
  uid: string;
  color: PieceColor;
  ws: WebSocket;
};

export type GameRoom = {
  id: string;
  mode: GameMode;
  chess: Chess;
  clients: Map<string, SocketClient>;
};

export type JoinMessage = {
  type: "join";
  roomId: string;
  mode: GameMode;
  uid: string;
};

export type MoveMessage = {
  type: "move";
  roomId: string;
  uid: string;
  from: string;
  to: string;
  promotion?: string;
};

export type InboundMessage = JoinMessage | MoveMessage;

export type SnapshotMessage = {
  type: "snapshot";
  roomId: string;
  mode: GameMode;
  fen: string;
  turn: PieceColor;
  isGameOver: boolean;
  legalMoves: Array<{ from: string; to: string; promotion?: string }>;
  capturedByWhite: string[];
  capturedByBlack: string[];
};

export type JoinedMessage = {
  type: "joined";
  roomId: string;
  mode: GameMode;
  uid: string;
  color: PieceColor;
};

export type ErrorMessage = {
  type: "error";
  message: string;
};

export type OutboundMessage = SnapshotMessage | JoinedMessage | ErrorMessage;
