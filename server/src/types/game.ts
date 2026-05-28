import type { WebSocket } from "ws";

export type GameMode = "single" | "multiplayer";
export type PieceColor = "w" | "b";
export type GameEndReason = "checkmate" | "draw" | "timeout" | "forfeit";

export type WsMeta = {
  roomId: string;
  uid: string;
};

export type SocketClient = {
  uid: string;
  color: PieceColor;
  ws: WebSocket;
};

export type GameRoomState = {
  id: string;
  mode: GameMode;
  fen: string;
  players: Record<string, PieceColor>;
  whiteMs: number;
  blackMs: number;
  activeTurnStartedAt: number | null;
  winner: PieceColor | null;
  endReason: GameEndReason | null;
  capturedByWhite: string[];
  capturedByBlack: string[];
  player1_id: string;
  player2_id: string | null;
};

export type JoinMessage = {
  type: "join";
  roomId: string;
  mode: GameMode;
  uid: string;
  player1_id: string;
  player2_id: string | null;
};

export type MoveMessage = {
  type: "move";
  roomId: string;
  uid: string;
  from: string;
  to: string;
  promotion?: string;
};

export type NewGameMessage = {
  type: "new_game";
  roomId: string;
  uid: string;
  mode: GameMode;
  init_tx: string;
  player1_id: string;
  player2_id: string | null;
};

export type ForfeitMessage = {
  type: "forfeit";
  roomId: string;
  uid: string;
};

export type InboundMessage = JoinMessage | MoveMessage | NewGameMessage | ForfeitMessage;

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
  whiteMs: number;
  blackMs: number;
  winner: PieceColor | null;
  endReason: GameEndReason | null;
  serverNow: number;
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

export type GameEndedMessage = {
  type: "game_end";
  roomId: string;
  winner: PieceColor | null;
  endReason: GameEndReason;
};

export type OutboundMessage = SnapshotMessage | JoinedMessage | ErrorMessage | GameEndedMessage;
