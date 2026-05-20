import { useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Link } from "react-router";
import { Chessboard, type ChessboardOptions, type SquareHandlerArgs } from "react-chessboard";
import type { Route } from "./+types/multiplayer.room";
import { loadSettings } from "~/utils/settings";

type WireMessage =
  | { type: "join"; roomId: string }
  | { type: "assign"; color: "w" | "b" }
  | { type: "state"; fen: string; turn: "w" | "b" }
  | { type: "move"; roomId: string; from: string; to: string; promotion?: string }
  | { type: "error"; message: string };

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `Multiplayer ${params.roomId} | Little Knights` }];
}

export default function MultiplayerRoomRoute({ params }: Route.ComponentProps) {
  const roomId = params.roomId;
  const chessRef = useRef(new Chess());
  const chessGame = chessRef.current;

  const [isMounted, setIsMounted] = useState(false);
  const [position, setPosition] = useState(chessGame.fen());
  const [moveFrom, setMoveFrom] = useState("");
  const [optionSquares, setOptionSquares] = useState<Record<string, React.CSSProperties>>({});
  const [myColor, setMyColor] = useState<"w" | "b">("w");
  const [status, setStatus] = useState("Connecting...");

  const socketRef = useRef<WebSocket | null>(null);
  const { wsUrl } = loadSettings();

  function syncPosition() {
    setPosition(chessGame.fen());
  }

  function clearSelection() {
    setMoveFrom("");
    setOptionSquares({});
  }

  function getMoveOptions(square: Square) {
    const moves = chessGame.moves({ square, verbose: true });

    if (moves.length === 0) {
      setOptionSquares({});
      return false;
    }

    const newSquares: Record<string, React.CSSProperties> = {};

    for (const move of moves) {
      const targetPiece = chessGame.get(move.to);
      const sourcePiece = chessGame.get(square);

      newSquares[move.to] = {
        background:
          targetPiece && targetPiece.color !== sourcePiece?.color
            ? "radial-gradient(circle, rgba(0,0,0,.22) 80%, transparent 80%)"
            : "radial-gradient(circle, rgba(0,0,0,.2) 25%, transparent 25%)",
        borderRadius: "50%"
      };
    }

    newSquares[square] = { background: "rgba(45, 135, 255, 0.35)" };
    setOptionSquares(newSquares);
    return true;
  }

  function sendMove(from: string, to: string, promotion?: string) {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    const payload: WireMessage = {
      type: "move",
      roomId,
      from,
      to,
      promotion
    };

    socket.send(JSON.stringify(payload));
    return true;
  }

  function onSquareClick({ square, piece }: SquareHandlerArgs) {
    if (!isMounted || chessGame.isGameOver() || chessGame.turn() !== myColor) {
      return;
    }

    if (!moveFrom && piece?.pieceType.startsWith(myColor)) {
      const hasMoveOptions = getMoveOptions(square as Square);
      if (hasMoveOptions) {
        setMoveFrom(square);
      }
      return;
    }

    const moves = chessGame.moves({ square: moveFrom as Square, verbose: true });
    const selected = moves.find((move) => move.from === moveFrom && move.to === square);

    if (!selected) {
      if (piece?.pieceType.startsWith(myColor)) {
        const hasMoveOptions = getMoveOptions(square as Square);
        setMoveFrom(hasMoveOptions ? square : "");
      } else {
        clearSelection();
      }
      return;
    }

    const nextMove = chessGame.move({ from: moveFrom, to: square, promotion: "q" });
    if (!nextMove) {
      clearSelection();
      return;
    }

    syncPosition();
    clearSelection();
    sendMove(nextMove.from, nextMove.to, nextMove.promotion);
  }

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      setStatus(`Connected to room ${roomId}`);
      const join: WireMessage = { type: "join", roomId };
      socket.send(JSON.stringify(join));
    });

    socket.addEventListener("close", () => {
      setStatus("Disconnected");
    });

    socket.addEventListener("error", () => {
      setStatus("Connection error");
    });

    socket.addEventListener("message", (event) => {
      let message: WireMessage;

      try {
        message = JSON.parse(event.data) as WireMessage;
      } catch {
        return;
      }

      if (message.type === "assign") {
        setMyColor(message.color);
        return;
      }

      if (message.type === "state") {
        chessGame.load(message.fen);
        syncPosition();
        return;
      }

      if (message.type === "move") {
        const localTurn = chessGame.turn();
        const expectedRemoteColor = myColor === "w" ? "b" : "w";
        if (localTurn !== expectedRemoteColor) {
          return;
        }

        const applied = chessGame.move({
          from: message.from,
          to: message.to,
          promotion: message.promotion ?? "q"
        });

        if (applied) {
          syncPosition();
          clearSelection();
        }
        return;
      }

      if (message.type === "error") {
        setStatus(message.message);
      }
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [roomId, wsUrl, isMounted, chessGame, myColor]);

  const turnLabel = useMemo(() => {
    if (chessGame.isGameOver()) {
      return "Game Over";
    }

    if (chessGame.turn() === myColor) {
      return "Your Turn";
    }

    return "Opponent's Turn";
  }, [position, chessGame, myColor]);

  const boardOrientation = myColor === "w" ? "white" : "black";

  const options: ChessboardOptions = {
    id: `multiplayer-${roomId}`,
    allowDragging: false,
    onSquareClick,
    position,
    boardOrientation,
    squareStyles: optionSquares,
    darkSquareStyle: { backgroundColor: "#bd8457" },
    lightSquareStyle: { backgroundColor: "#e6c99a" }
  };

  return (
    <main className="lk-shell">
      <header className="lk-header">
        <h1 className="lk-title">Multiplayer</h1>
        <p className="lk-subtitle">{turnLabel}</p>
        <p className="lk-room-state">{status}</p>
      </header>

      <div className="lk-board-wrap">
        {isMounted ? <Chessboard options={options} /> : <div className="lk-board-placeholder" />}
      </div>

      <div className="lk-multi-actions">
        <Link className="lk-menu-button" to="/">
          Home
        </Link>
      </div>
    </main>
  );
}
