import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Chess } from "chess.js";
import { Chessboard, type ChessboardOptions, type SquareHandlerArgs } from "react-chessboard";
import CapturedTray from "~/components/chess/CapturedTray";
import { loadSettings, saveSettings } from "~/utils/settings";
import { signInUser } from "~/utils/auth";
import { getOrCreateUid } from "~/utils/user";
import type {
  ClientMessage,
  GameMode,
  GameSnapshotMessage,
  JoinedMessage,
  MoveMessage,
  PieceColor,
  ServerMessage
} from "~/types/game";

type NetworkChessGameProps = {
  mode: GameMode;
  roomId: string;
  title: string;
  opponentLabel: string;
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

export default function NetworkChessGame({ mode, roomId, opponentLabel }: NetworkChessGameProps) {
  const navigate = useNavigate();

  const [isMounted, setIsMounted] = useState(false);
  const [snapshot, setSnapshot] = useState<GameSnapshotMessage | null>(null);
  const [displayFen, setDisplayFen] = useState<string>("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR");
  const [myColor, setMyColor] = useState<PieceColor>("w");
  const [moveFrom, setMoveFrom] = useState("");
  const [optionSquares, setOptionSquares] = useState<Record<string, React.CSSProperties>>({});
  const [status, setStatus] = useState("Connecting...");
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [clockNow, setClockNow] = useState(Date.now());
  const [flipped, setFlipped] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const isSingle = mode === "single";
  const [showStartModal, setShowStartModal] = useState(isSingle);
  const [readyToPlay, setReadyToPlay] = useState(false);
  const [startLoading, setStartLoading] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const lastFenRef = useRef<string | null>(null);

  const wsUrl = loadSettings().wsUrl;
  const uid = useMemo(() => getOrCreateUid(), []);

  function playTone(frequency: number, durationMs: number) {
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
    osc.frequency.value = frequency;
    gain.gain.value = 0.0001;
    gain.gain.exponentialRampToValueAtTime(0.15, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + durationMs / 1000);
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

    const moves = snapshot.legalMoves.filter((move) => move.from === sourceSquare);
    if (moves.length === 0) {
      setOptionSquares({});
      return false;
    }

    const next: Record<string, React.CSSProperties> = {
      [sourceSquare]: { background: "rgba(200, 169, 126, 0.45)" }
    };

    for (const move of moves) {
      next[move.to] = {
        background: "radial-gradient(circle, rgba(18,18,18,.25) 22%, transparent 22%)",
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

  function sendNewGame() {
    return sendJson(socketRef.current, {
      type: "new_game",
      uid,
      roomId
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

    const legal = snapshot.legalMoves.find((move) => move.from === moveFrom && move.to === square);

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
    const optimisticMove = optimisticGame.move({ from: moveFrom, to: square, promotion: "q" });

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
        serverNow: Date.now()
      };
    });
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
    if (!isMounted || isSingle) {
      return;
    }

    signInUser(uid).then((signedIn) => {
      if (!signedIn) {
        setStatus("Sign in failed");
        setConnectionState("disconnected");
        return;
      }

      setReadyToPlay(true);
    });
  }, [isMounted, isSingle, uid]);

  useEffect(() => {
    const timer = setInterval(() => setClockNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  async function handleStartPlay() {
    setStartLoading(true);
    setStartError(null);

    const signedIn = await signInUser(uid);
    if (!signedIn) {
      setStartError("Sign in failed. Register your player before competing.");
      setStartLoading(false);
      return;
    }

    setReadyToPlay(true);
    setShowStartModal(false);
    setStartLoading(false);
  }

  useEffect(() => {
    if (!isMounted || !readyToPlay) {
      return;
    }

    setConnectionState("connecting");
    setStatus("Connecting...");

    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      setConnectionState("connected");
      setStatus("Connected");
      sendJson(socket, { type: "join", mode, roomId, uid });
    });

    socket.addEventListener("close", () => {
      setConnectionState("disconnected");
      setStatus("Disconnected");
    });

    socket.addEventListener("error", () => {
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
        if (lastFenRef.current && lastFenRef.current !== next.fen && next.turn !== myColor) {
          playMoveSound();
        }
        lastFenRef.current = next.fen;
        setSnapshot(next);
        setDisplayFen(next.fen);
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
      socket.close();
      socketRef.current = null;
    };
  }, [isMounted, readyToPlay, mode, roomId, uid, wsUrl, myColor, reconnectNonce]);

  const whiteBase = snapshot?.whiteMs ?? 60_000;
  const blackBase = snapshot?.blackMs ?? 60_000;
  const elapsedSinceServer = snapshot ? Math.max(0, clockNow - snapshot.serverNow) : 0;
  const whiteLive = snapshot?.turn === "w" && !snapshot?.isGameOver ? whiteBase - elapsedSinceServer : whiteBase;
  const blackLive = snapshot?.turn === "b" && !snapshot?.isGameOver ? blackBase - elapsedSinceServer : blackBase;

  const myMs = myColor === "w" ? whiteLive : blackLive;
  const oppMs = myColor === "w" ? blackLive : whiteLive;
  const myTurn = snapshot?.turn === myColor && !snapshot?.isGameOver;

  const myCaptured = myColor === "w" ? snapshot?.capturedByWhite ?? [] : snapshot?.capturedByBlack ?? [];
  const oppCaptured = myColor === "w" ? snapshot?.capturedByBlack ?? [] : snapshot?.capturedByWhite ?? [];
  const myCapturedColor = myColor === "w" ? "b" : "w";
  const oppCapturedColor = myColor === "w" ? "w" : "b";

  const resultLabel = snapshot?.winner
    ? snapshot.winner === myColor
      ? "You Win"
      : `${opponentLabel} Wins`
    : "Draw";

  const endReason = snapshot?.endReason === "timeout" ? "Time Up" : snapshot?.endReason === "checkmate" ? "Checkmate" : "Draw";

  const options: ChessboardOptions = {
    id: `${mode}-${roomId}`,
    allowDragging: false,
    onSquareClick,
    position: displayFen,
    boardOrientation: flipped ? (myColor === "w" ? "black" : "white") : myColor === "w" ? "white" : "black",
    squareStyles: optionSquares,
    darkSquareStyle: { backgroundColor: "#8b6048" },
    lightSquareStyle: { backgroundColor: "#c8a97e" }
  };

  const statusClass =
    connectionState === "connected"
      ? "lk-dot-connected"
      : connectionState === "disconnected"
        ? "lk-dot-disconnected"
        : "lk-dot-connecting";

  const handleCloseGame = () => {
    socketRef?.current?.close();
    navigate("/")
  };

  return (
    <section className="lk-skin-shell">
      <div className="lk-phone-shell">
        <header className="lk-nav">
          <button className="lk-back" onClick={() => setShowExitModal(true)} type="button">‹</button>
          <p className="lk-nav-title flex items-center gap-1">
            <span className="text-[20px]">♞</span>
            LITTLE KNIGHTS
            <span className="text-[20px]">♘</span>
          </p>
          <button className="lk-sound-toggle" onClick={toggleSound} type="button">{soundEnabled ? "🔊" : "🔇"}</button>
        </header>

        <div className="h-12.5 flex items-center justify-center">
          <p className="lk-turn-inline">{myTurn ? "your turn" : `${opponentLabel.toLowerCase()}'s turn`}</p>
        </div>

        <section className="lk-player-bar lk-player-bar-top">
          <div className="lk-bar-left">
            <img alt="Opponent avatar" className="lk-avatar-img lk-avatar-dark" src="/avatars/ai.svg" />
            <div>
              <strong className="lk-bar-name">{opponentLabel}</strong>
              <div className="lk-bar-captured"><CapturedTray pieceColor={oppCapturedColor} pieces={oppCaptured} /></div>
            </div>
          </div>
          <div className={`lk-clock ${!myTurn ? "lk-clock-active" : ""}`}>{formatMs(oppMs)}</div>
        </section>

        <div className="lk-board-frame">{isMounted ? <Chessboard options={options} /> : <div className="lk-board-placeholder" />}</div>

        <section className="lk-player-bar lk-player-bar-bottom">
          <div className="lk-bar-left">
            <img alt="Your avatar" className="lk-avatar-img" src="/avatars/me.svg" />
            <div>
              <strong className="lk-bar-name">You</strong>
              <div className="lk-bar-captured"><CapturedTray pieceColor={myCapturedColor} pieces={myCaptured} /></div>
            </div>
          </div>
          <div className={`lk-clock ${myTurn ? "lk-clock-active" : ""}`}>{formatMs(myMs)}</div>
        </section>

        {/* AI MAKE SURE NOT TO UNCOMMENT THIS */}
        {/* <div className="lk-actions-row">
          <button className="lk-action-btn" type="button">½ Draw</button>
          <button className="lk-action-btn lk-action-danger" type="button">Resign</button>
          <button className="lk-action-btn" onClick={() => setFlipped((prev) => !prev)} type="button">⇅ Flip</button>
        </div> */}

        <div className="lk-status-row">
          <span className={`lk-status-dot ${statusClass}`} />
          <p className="lk-room-state">{status}</p>
        </div>

        {/* AI MAKE SURE NOT TO UNCOMMENT THIS */}
        {/* <footer className="lk-bottom-nav">
          <span className="lk-bottom-active-line" />
          <span className="lk-nav-item lk-nav-item-active">♟ GAME</span>
          <span className="lk-nav-item">⚑ BRACKET</span>
          <span className="lk-nav-item">◎ WALLET</span>
          <span className="lk-nav-item">☰ MENU</span>
        </footer> */}

        {snapshot?.isGameOver ? (
          <div className="lk-modal-backdrop">
            <div className="lk-modal lk-modal-dark">
              <h2>{resultLabel}</h2>
              <p>{endReason}</p>
              <button className="lk-action-btn lk-action-primary" onClick={sendNewGame} type="button">
                Play Again
              </button>
            </div>
          </div>
        ) : null}

        {showExitModal ? (
          <div className="lk-modal-backdrop">
            <div className="lk-modal lk-modal-dark">
              <h2>End Game?</h2>
              <p>Do you wish to end game</p>
              <div className="lk-modal-actions">
                <button className="lk-action-btn" onClick={() => setShowExitModal(false)} type="button">No</button>
                <button className="lk-action-btn lk-action-danger" onClick={handleCloseGame} type="button">Yes</button>
              </div>
            </div>
          </div>
        ) : null}

        {showStartModal ? (
          <div className="lk-modal-backdrop">
            <div className="lk-modal lk-modal-dark lk-start-modal">
              <button
                aria-label="Exit to home"
                className="lk-modal-close"
                onClick={() => navigate("/")}
                type="button"
              >
                ×
              </button>

              <div aria-hidden className="lk-start-loader">
                <span className="lk-start-loader-piece">♞</span>
                <span className="lk-start-loader-ring" />
              </div>

              <p className="lk-start-kicker">Timed Competition</p>
              <h2>Little Knights</h2>
              <p className="lk-start-copy">
                Entry costs $1. Win against the bot and take home $2 (100% profit). If your clock hits zero, you lose.
              </p>
              <p className="lk-start-terms">By proceeding, you agree to the competition terms.</p>

              {startError ? <p className="lk-start-error">{startError}</p> : null}

              <button
                className="lk-action-btn lk-action-primary lk-start-play"
                disabled={startLoading}
                onClick={handleStartPlay}
                type="button"
              >
                {startLoading ? "Preparing..." : "Play"}
              </button>
            </div>
          </div>
        ) : null}

        {connectionState === "disconnected" && readyToPlay ? (
          <div className="lk-modal-backdrop">
            <div className="lk-modal lk-modal-dark">
              <h2>Disconnected</h2>
              <p>Disconnected from server</p>
              <button className="lk-action-btn lk-action-primary" onClick={() => setReconnectNonce((v) => v + 1)} type="button">
                Try Again
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
