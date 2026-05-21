export type GameMode = "single" | "multiplayer";
export type PieceColor = "w" | "b";
export type GameEndReason = "checkmate" | "draw" | "timeout";

export type LegalMove = {
  from: string;
  to: string;
  promotion?: string;
};

export type GameSnapshotMessage = {
  type: "snapshot";
  roomId: string;
  mode: GameMode;
  fen: string;
  turn: PieceColor;
  isGameOver: boolean;
  legalMoves: LegalMove[];
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

export type ServerMessage = GameSnapshotMessage | JoinedMessage | ErrorMessage;

export type JoinMessage = {
  type: "join";
  uid: string;
  mode: GameMode;
  roomId: string;
};

export type MoveMessage = {
  type: "move";
  uid: string;
  roomId: string;
  from: string;
  to: string;
  promotion?: string;
};

export type NewGameMessage = {
  type: "new_game";
  uid: string;
  roomId: string;
};

export type ClientMessage = JoinMessage | MoveMessage | NewGameMessage;
