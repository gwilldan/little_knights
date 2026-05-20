import { useEffect, useMemo, useRef, useState } from "react";
import { Chessboard, type ChessboardOptions, type SquareHandlerArgs } from "react-chessboard";
import CapturedTray from "~/components/chess/CapturedTray";
import ChessHeader from "~/components/chess/ChessHeader";
import PlayerRow from "~/components/chess/PlayerRow";
import { loadSettings, saveSettings } from "~/utils/settings";
import { getOrCreateUid } from "~/utils/user";
import type { ClientMessage, GameMode, GameSnapshotMessage, JoinedMessage, MoveMessage, ServerMessage } from "~/types/game";

type NetworkChessGameProps = {
  mode: GameMode;
  roomId: string;
  title: string;
  opponentLabel: string;
};

function sendJson(socket: WebSocket | null, payload: ClientMessage) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return false;
  }

  socket.send(JSON.stringify(payload));
  return true;
}

export default function NetworkChessGame({ mode, roomId, title, opponentLabel }: NetworkChessGameProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [snapshot, setSnapshot] = useState<GameSnapshotMessage | null>(null);
  const [myColor, setMyColor] = useState<"w" | "b">("w");
  const [moveFrom, setMoveFrom] = useState("");
  const [optionSquares, setOptionSquares] = useState<Record<string, React.CSSProperties>>({});
  const [status, setStatus] = useState("Connecting...");
  const [soundEnabled, setSoundEnabled] = useState(true);

  const audioContextRef = useRef<AudioContext | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const lastFenRef = useRef<string | null>(null);

  const settings = loadSettings();
  const wsUrl = settings.wsUrl;

  const uid = useMemo(() => getOrCreateUid(), []);

  function playMoveSound() {
    if (!soundEnabled || typeof window === "undefined") {
      return false;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new window.AudioContext();
    }

    const context = audioContextRef.current;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = "triangle";
    osc.frequency.value = 580;
    gain.gain.value = 0.0001;
    gain.gain.exponentialRampToValueAtTime(0.15, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.09);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start();
    osc.stop(context.currentTime + 0.1);
    return true;
  }

  function clearSelection() {
    setMoveFrom("");
    setOptionSquares({});
  }

  function setMoveOptions(sourceSquare: string) {
    if (!snapshot) {
      return false;
    }

    const moves = snapshot.legalMoves.filter((move) => move.from === sourceSquare);
    if (moves.length === 0) {
      setOptionSquares({});
      return false;
    }

    const next: Record<string, React.CSSProperties> = {
      [sourceSquare]: { background: "rgba(45, 135, 255, 0.35)" }
    };

    for (const move of moves) {
      next[move.to] = {
        background: "radial-gradient(circle, rgba(0,0,0,.2) 25%, transparent 25%)",
        borderRadius: "50%"
      };
    }

    setOptionSquares(next);
    return true;
  }

  function sendMove(from: string, to: string) {
    const payload: MoveMessage = {
      type: "move",
      uid,
      roomId,
      from,
      to,
      promotion: "q"
    };

    return sendJson(socketRef.current, payload);
  }

  function onSquareClick({ square, piece }: SquareHandlerArgs) {
    if (!snapshot || snapshot.isGameOver || snapshot.turn !== myColor) {
      return;
    }

    if (!moveFrom && piece?.pieceType.startsWith(myColor)) {
      const hasMoves = setMoveOptions(square);
      if (hasMoves) {
        setMoveFrom(square);
      }
      return;
    }

    const legal = snapshot.legalMoves.find((move) => move.from === moveFrom && move.to === square);

    if (!legal) {
      if (piece?.pieceType.startsWith(myColor)) {
        const hasMoves = setMoveOptions(square);
        setMoveFrom(hasMoves ? square : "");
      } else {
        clearSelection();
      }
      return;
    }

    sendMove(moveFrom, square);
    clearSelection();
  }

  function toggleSound() {
    const nextValue = !soundEnabled;
    setSoundEnabled(nextValue);
    saveSettings({ ...loadSettings(), soundEnabled: nextValue });
    return true;
  }

  useEffect(() => {
    setIsMounted(true);
    setSoundEnabled(loadSettings().soundEnabled);
  }, []);

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      setStatus(`Connected: ${roomId}`);
      const joinMessage = {
        type: "join",
        mode,
        roomId,
        uid
      } as const;
      sendJson(socket, joinMessage);
    });

    socket.addEventListener("close", () => setStatus("Disconnected"));
    socket.addEventListener("error", () => setStatus("Connection error"));

    socket.addEventListener("message", (event) => {
      let message: ServerMessage;

      try {
        message = JSON.parse(event.data) as ServerMessage;
      } catch {
        return;
      }

      if (message.type === "joined") {
        const joined = message as JoinedMessage;
        setMyColor(joined.color);
        return;
      }

      if (message.type === "snapshot") {
        const next = message as GameSnapshotMessage;
        if (lastFenRef.current && lastFenRef.current !== next.fen) {
          playMoveSound();
        }
        lastFenRef.current = next.fen;
        setSnapshot(next);
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
  }, [isMounted, mode, roomId, uid, wsUrl]);

  const turnLabel = !snapshot
    ? "Loading"
    : snapshot.isGameOver
      ? "Game Over"
      : snapshot.turn === myColor
        ? "Your Turn"
        : `${opponentLabel}'s Turn`;

  const options: ChessboardOptions = {
    id: `${mode}-${roomId}`,
    allowDragging: false,
    onSquareClick,
    position: snapshot?.fen ?? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR",
    boardOrientation: myColor === "w" ? "white" : "black",
    squareStyles: optionSquares,
    darkSquareStyle: { backgroundColor: "#bd8457" },
    lightSquareStyle: { backgroundColor: "#e6c99a" }
  };

  return (
    <section className="lk-shell">
      <ChessHeader turnLabel={turnLabel} />
      <PlayerRow opponentLabel={opponentLabel} />
      <CapturedTray
        capturedByWhite={snapshot?.capturedByWhite ?? []}
        capturedByBlack={snapshot?.capturedByBlack ?? []}
      />
      <button className="lk-sound-toggle" onClick={toggleSound} type="button">
        Sound: {soundEnabled ? "On" : "Off"}
      </button>

      <div className="lk-board-wrap">{isMounted ? <Chessboard options={options} /> : <div className="lk-board-placeholder" />}</div>

      <p className="lk-room-state">{title} | {status}</p>
    </section>
  );
}
