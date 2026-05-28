import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Link, useNavigate } from "react-router";
import { Chess } from "chess.js";
import {
  Chessboard,
  type ChessboardOptions,
  type SquareHandlerArgs,
} from "react-chessboard";
import CapturedTray from "~/components/chess/CapturedTray";
import { loadSettings, saveSettings } from "~/utils/settings";
import { getOrCreateUid } from "~/utils/user";
import type {
  ClientMessage,
  GameEndedMessage,
  GameMode,
  GameSnapshotMessage,
  JoinedMessage,
  MoveMessage,
  PieceColor,
  ServerMessage,
} from "~/types/game";
import ExitButton from "./exitButton";

const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";

type NetworkChessGameProps = {
  mode: GameMode;
  roomId: string;
  title: string;
  opponentLabel: string;
  setStartLoading: Dispatch<SetStateAction<boolean>>;
  onSinglePlayAgain?: () => void | Promise<void>;
  uid?: string;
  enabled?: boolean;
};

type ConnectionState = "connecting" | "connected" | "disconnected";

function sendJson(socket: WebSocket | null, payload: ClientMessage) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return false;
  }

  socket.send(JSON.stringify(payload));
  return true;
}

function formatMs(ms: number) {
  const safe = Math.max(0, ms);
  const totalSeconds = Math.ceil(safe / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export default function NetworkChessGame({
  mode,
  roomId,
  opponentLabel,
  uid: uidProp,
  onSinglePlayAgain,
  enabled = true,
  setStartLoading,
}: NetworkChessGameProps) {
  const navigate = useNavigate();

  const [isMounted, setIsMounted] = useState(false);
  const [snapshot, setSnapshot] = useState<GameSnapshotMessage | null>(null);
  const [displayFen, setDisplayFen] = useState<string>(INITIAL_FEN);
  const [myColor, setMyColor] = useState<PieceColor>("w");
  const [moveFrom, setMoveFrom] = useState("");
  const [optionSquares, setOptionSquares] = useState<
    Record<string, React.CSSProperties>
  >({});
  const [status, setStatus] = useState("Connecting...");
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [clockNow, setClockNow] = useState(Date.now());
  const [flipped, setFlipped] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const [gameEndMessage, setGameEndMessage] = useState<GameEndedMessage | null>(
    null,
  );

  const audioContextRef = useRef<AudioContext | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const lastFenRef = useRef<string | null>(null);
  const soundEnabledRef = useRef(true);
  const pendingForfeitExitRef = useRef(false);
  const forfeitFallbackTimeoutRef = useRef<number | null>(null);

  const wsUrl = loadSettings().wsUrl;
  const uid = useMemo(() => uidProp ?? getOrCreateUid(), [uidProp]);

  function playTone(frequency: number, durationMs: number) {
    if (!soundEnabledRef.current || typeof window === "undefined") {
      return false;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new window.AudioContext();
    }

    const context = audioContextRef.current;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = "triangle";
    osc.frequency.value = frequency;
    gain.gain.value = 0.0001;
    gain.gain.exponentialRampToValueAtTime(0.15, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      context.currentTime + durationMs / 1000,
    );
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start();
    osc.stop(context.currentTime + durationMs / 1000 + 0.01);
    return true;
  }

  function playMoveSound() {
    return playTone(580, 90);
  }

  function playIllegalMoveSound() {
    playTone(260, 70);
    return playTone(200, 90);
  }

  function clearSelection() {
    setMoveFrom("");
    setOptionSquares({});
  }

  function setMoveOptions(sourceSquare: string) {
    if (!snapshot) {
      return false;
    }

    const moves = snapshot.legalMoves.filter(
      (move) => move.from === sourceSquare,
    );
    if (moves.length === 0) {
      setOptionSquares({});
      return false;
    }

    const next: Record<string, React.CSSProperties> = {
      [sourceSquare]: { background: "rgba(200, 169, 126, 0.45)" },
    };

    for (const move of moves) {
      next[move.to] = {
        background:
          "radial-gradient(circle, rgba(18,18,18,.25) 22%, transparent 22%)",
        borderRadius: "50%",
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
      promotion: "q",
    };

    return sendJson(socketRef.current, payload);
  }

  function sendNewGame() {
    return sendJson(socketRef.current, {
      type: "new_game",
      uid,
      roomId,
      init_tx: "",
    });
  }

  function sendForfeit() {
    return sendJson(socketRef.current, {
      type: "forfeit",
      uid,
      roomId,
    });
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

    const legal = snapshot.legalMoves.find(
      (move) => move.from === moveFrom && move.to === square,
    );

    if (!legal) {
      if (piece?.pieceType.startsWith(myColor)) {
        const hasMoves = setMoveOptions(square);
        setMoveFrom(hasMoves ? square : "");
      } else {
        playIllegalMoveSound();
        clearSelection();
      }
      return;
    }

    const optimisticGame = new Chess(displayFen);
    const optimisticMove = optimisticGame.move({
      from: moveFrom,
      to: square,
      promotion: "q",
    });

    if (!optimisticMove) {
      playIllegalMoveSound();
      clearSelection();
      return;
    }

    setDisplayFen(optimisticGame.fen());
    setSnapshot((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        fen: optimisticGame.fen(),
        turn: prev.turn === "w" ? "b" : "w",
        whiteMs: 60_000,
        blackMs: 60_000,
        serverNow: Date.now(),
      };
    });
    sendMove(moveFrom, square);
    clearSelection();
  }

  function toggleSound() {
    const nextValue = !soundEnabled;
    soundEnabledRef.current = nextValue;
    setSoundEnabled(nextValue);
    saveSettings({ ...loadSettings(), soundEnabled: nextValue });
    return true;
  }

  useEffect(() => {
    setIsMounted(true);
    const storedSoundEnabled = loadSettings().soundEnabled;
    soundEnabledRef.current = storedSoundEnabled;
    setSoundEnabled(storedSoundEnabled);

    return () => {
      if (forfeitFallbackTimeoutRef.current) {
        window.clearTimeout(forfeitFallbackTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setClockNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isMounted || !enabled) {
      return;
    }

    setConnectionState("connecting");
    setStatus("Connecting...");

    let active = true;
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      if (!active) return;
      setConnectionState("connected");
      setStatus("Connected");
      sendJson(socket, { type: "join", mode, roomId, uid });
    });

    socket.addEventListener("close", () => {
      if (!active) return;
      setConnectionState("disconnected");
      setStatus("Disconnected");
    });

    socket.addEventListener("error", () => {
      if (!active) return;
      setConnectionState("disconnected");
      setStatus("Disconnected");
    });

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
        if (mode === "single" && lastFenRef.current && lastFenRef.current !== next.fen) {
          playMoveSound();
        }
        lastFenRef.current = next.fen;
        setSnapshot(next);
        setDisplayFen(next.fen);
        if (!next.isGameOver) {
          setGameEndMessage(null);
        }
        return;
      }

      if (message.type === "game_end") {
        setGameEndMessage(message as GameEndedMessage);
        if (pendingForfeitExitRef.current) {
          pendingForfeitExitRef.current = false;
          setIsExiting(false);
          if (forfeitFallbackTimeoutRef.current) {
            window.clearTimeout(forfeitFallbackTimeoutRef.current);
            forfeitFallbackTimeoutRef.current = null;
          }
          socket.close();
          navigate("/");
        }
        return;
      }

      if (message.type === "error") {
        if (message.message.toLowerCase().includes("illegal")) {
          playIllegalMoveSound();
        }
        setStatus(message.message);
      }
    });

    return () => {
      active = false;
      socket.close();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [enabled, isMounted, mode, roomId, uid, wsUrl, reconnectNonce]);

  const whiteBase = snapshot?.whiteMs ?? 60_000;
  const blackBase = snapshot?.blackMs ?? 60_000;
  const elapsedSinceServer = snapshot
    ? Math.max(0, clockNow - snapshot.serverNow)
    : 0;
  const whiteLive =
    snapshot?.turn === "w" && !snapshot?.isGameOver
      ? whiteBase - elapsedSinceServer
      : whiteBase;
  const blackLive =
    snapshot?.turn === "b" && !snapshot?.isGameOver
      ? blackBase - elapsedSinceServer
      : blackBase;

  const myMs = myColor === "w" ? whiteLive : blackLive;
  const oppMs = myColor === "w" ? blackLive : whiteLive;
  const myTurn = snapshot?.turn === myColor && !snapshot?.isGameOver;

  const myCaptured =
    myColor === "w"
      ? (snapshot?.capturedByWhite ?? [])
      : (snapshot?.capturedByBlack ?? []);
  const oppCaptured =
    myColor === "w"
      ? (snapshot?.capturedByBlack ?? [])
      : (snapshot?.capturedByWhite ?? []);
  const myCapturedColor = myColor === "w" ? "b" : "w";
  const oppCapturedColor = myColor === "w" ? "w" : "b";

  const winner = gameEndMessage?.winner ?? snapshot?.winner ?? null;
  const endReasonValue =
    gameEndMessage?.endReason ?? snapshot?.endReason ?? "draw";

  const resultLabel = winner
    ? winner === myColor
      ? "You Win"
      : `${opponentLabel} Wins`
    : "Draw";

  const endReason =
    endReasonValue === "timeout"
      ? "Time Up"
      : endReasonValue === "checkmate"
        ? "Checkmate"
        : endReasonValue === "forfeit"
          ? "Forfeit"
          : "Draw";

  const options: ChessboardOptions = {
    id: `${mode}-${roomId}`,
    allowDragging: false,
    onSquareClick,
    position: displayFen,
    boardOrientation: flipped
      ? myColor === "w"
        ? "black"
        : "white"
      : myColor === "w"
        ? "white"
        : "black",
    squareStyles: optionSquares,
    darkSquareStyle: { backgroundColor: "#8b6048" },
    lightSquareStyle: { backgroundColor: "#c8a97e" },
  };

  const statusClass =
    connectionState === "connected"
      ? "lk-dot-connected"
      : connectionState === "disconnected"
        ? "lk-dot-disconnected"
        : "lk-dot-connecting";

  const handleCloseGame = () => {
    if (mode === "single" && snapshot && !snapshot.isGameOver) {
      pendingForfeitExitRef.current = true;
      setIsExiting(true);
      setStatus("Forfeiting...");
      setShowExitModal(false);
      const sent = sendForfeit();
      if (!sent) {
        pendingForfeitExitRef.current = false;
        setIsExiting(false);
        navigate("/");
        return;
      }

      forfeitFallbackTimeoutRef.current = window.setTimeout(() => {
        pendingForfeitExitRef.current = false;
        setIsExiting(false);
        socketRef.current?.close();
        navigate("/");
      }, 2_500);
      return;
    }

    socketRef.current?.close();
    navigate("/");
  };

  const handleReconnect = () => {
    if (mode !== "single") {
      return;
    }

    setConnectionState("connecting");
    setStatus("Reconnecting...");
    socketRef.current?.close();
    setReconnectNonce((nonce) => nonce + 1);
  };

  const handlePlayAgain = () => {
    if (mode === "single") {
      socketRef?.current?.close();
      setStartLoading(false);
      setSnapshot(null);
      setDisplayFen(INITIAL_FEN);
      setGameEndMessage(null);
      clearSelection();
      if (onSinglePlayAgain) {
        void onSinglePlayAgain();
      }
      return;
    }

    sendNewGame();
    setGameEndMessage(null);
  };

  return (
    <section className="lk-skin-shell">
      <div className="lk-phone-shell">
        <header className="lk-nav">
          <button
            className="lk-back"
            onClick={() => setShowExitModal(true)}
            type="button"
          >
            ‹
          </button>
          <p className="lk-nav-title flex items-center gap-1">
            <span className="text-[20px]">♞</span>
            LITTLE KNIGHTS
            <span className="text-[20px]">♘</span>
          </p>
          <button
            className="lk-sound-toggle"
            onClick={toggleSound}
            type="button"
          >
            {soundEnabled ? "🔊" : "🔇"}
          </button>
        </header>

        <div className="h-12.5 flex items-center justify-center">
          <p className="lk-turn-inline">
            {myTurn ? "your turn" : `${opponentLabel.toLowerCase()}'s turn`}
          </p>
        </div>

        <section className="lk-player-bar lk-player-bar-top">
          <div className="lk-bar-left">
            <img
              alt="Opponent avatar"
              className="lk-avatar-img lk-avatar-dark"
              src="/avatars/ai.svg"
            />
            <div>
              <strong className="lk-bar-name">{opponentLabel}</strong>
              <div className="lk-bar-captured">
                <CapturedTray
                  pieceColor={oppCapturedColor}
                  pieces={oppCaptured}
                />
              </div>
            </div>
          </div>
          <div className={`lk-clock ${!myTurn ? "lk-clock-active" : ""}`}>
            {formatMs(oppMs)}
          </div>
        </section>

        <div className="lk-board-frame">
          {isMounted ? (
            <Chessboard options={options} />
          ) : (
            <div className="lk-board-placeholder" />
          )}
        </div>

        <section className="lk-player-bar lk-player-bar-bottom">
          <div className="lk-bar-left">
            <img
              alt="Your avatar"
              className="lk-avatar-img"
              src="/avatars/me.svg"
            />
            <div>
              <strong className="lk-bar-name">You</strong>
              <div className="lk-bar-captured">
                <CapturedTray
                  pieceColor={myCapturedColor}
                  pieces={myCaptured}
                />
              </div>
            </div>
          </div>
          <div className={`lk-clock ${myTurn ? "lk-clock-active" : ""}`}>
            {formatMs(myMs)}
          </div>
        </section>

        <div className="lk-status-row">
          <span className={`lk-status-dot ${statusClass}`} />
          <p className="lk-room-state">{status}</p>
        </div>

        {snapshot?.isGameOver ? (
          <div className="lk-modal-backdrop">
            <div className="lk-modal lk-modal-dark relative">
              <ExitButton />
              <h2>{resultLabel}</h2>
              <p>{endReason}</p>
              <button
                className="lk-action-btn lk-action-primary"
                onClick={handlePlayAgain}
                type="button"
              >
                Play Again
              </button>
            </div>
          </div>
        ) : null}

        {showExitModal ? (
          <div className="lk-modal-backdrop">
            <div className="lk-modal lk-modal-dark">
              <h2>End Game?</h2>
              <p>Exiting this game means forfeiture. AI wins and the game will be resolved.</p>
              <div className="lk-modal-actions">
                <button
                  className="lk-action-btn"
                  onClick={() => setShowExitModal(false)}
                  type="button"
                >
                  No
                </button>
                <button
                  className="lk-action-btn lk-action-danger"
                  onClick={handleCloseGame}
                  type="button"
                >
                  Yes, Forfeit
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {isExiting ? (
          <div className="lk-modal-backdrop">
            <div className="lk-modal lk-modal-dark">
              <div aria-hidden className="lk-start-loader">
                <span className="lk-start-loader-piece">♞</span>
                <span className="lk-start-loader-ring" />
              </div>
              <h2>Exiting</h2>
              <p>Resolving game...</p>
            </div>
          </div>
        ) : null}

        {enabled && !isExiting && connectionState === "disconnected" ? (
          <div className="lk-modal-backdrop">
            <ExitButton />
            <div className="lk-modal lk-modal-dark">
              <h2>Disconnected</h2>
              <p>Disconnected from server</p>
              {mode === "single" ? (
                <button
                  className="lk-action-btn lk-action-primary my-4"
                  onClick={handleReconnect}
                  type="button"
                >
                  Reconnect to game
                </button>
              ) : (
                <Link
                  className="lk-action-btn lk-action-primary my-4"
                  to={"/single/play"}
                >
                  Reconnect to game
                </Link>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
