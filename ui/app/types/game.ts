export type GameMode = "single" | "multiplayer";

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
  turn: "w" | "b";
  isGameOver: boolean;
  legalMoves: LegalMove[];
  capturedByWhite: string[];
  capturedByBlack: string[];
};

export type JoinedMessage = {
  type: "joined";
  roomId: string;
  mode: GameMode;
  uid: string;
  color: "w" | "b";
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

export type ClientMessage = JoinMessage | MoveMessage;
