import { useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard, type ChessboardOptions, type SquareHandlerArgs } from "react-chessboard";
import CapturedTray from "~/components/chess/CapturedTray";
import ChessHeader from "~/components/chess/ChessHeader";
import PlayerRow from "~/components/chess/PlayerRow";
import UndoControl from "~/components/chess/UndoControl";
import { selectBestMove } from "~/utils/chessAi";
import { loadSettings, saveSettings } from "~/utils/settings";

type CaptureState = {
  capturedByWhite: string[];
  capturedByBlack: string[];
};

function getCaptureState(game: Chess): CaptureState {
  const capturedByWhite: string[] = [];
  const capturedByBlack: string[] = [];

  const history = game.history({ verbose: true });

  for (const move of history) {
    if (!move.captured) {
      continue;
    }

    if (move.color === "w") {
      capturedByWhite.push(move.captured);
    } else {
      capturedByBlack.push(move.captured);
    }
  }

  return { capturedByWhite, capturedByBlack };
}

export default function ChessGame() {
  const chessGameRef = useRef(new Chess());
  const chessGame = chessGameRef.current;

  const [isMounted, setIsMounted] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [chessPosition, setChessPosition] = useState(chessGame.fen());
  const [moveFrom, setMoveFrom] = useState("");
  const [optionSquares, setOptionSquares] = useState<Record<string, React.CSSProperties>>({});
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioContextRef = useRef<AudioContext | null>(null);

  const captureState = useMemo(() => getCaptureState(chessGame), [chessPosition, chessGame]);

  function refreshPosition() {
    setChessPosition(chessGame.fen());
  }

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

    newSquares[square] = {
      background: "rgba(45, 135, 255, 0.35)"
    };

    setOptionSquares(newSquares);
    return true;
  }

  function onSquareClick({ square, piece }: SquareHandlerArgs) {
    if (isThinking || chessGame.turn() !== "w" || chessGame.isGameOver()) {
      return;
    }

    if (!moveFrom && piece?.pieceType.startsWith("w")) {
      const hasMoveOptions = getMoveOptions(square as Square);
      if (hasMoveOptions) {
        setMoveFrom(square);
      }
      return;
    }

    const moves = chessGame.moves({
      square: moveFrom as Square,
      verbose: true
    });

    const foundMove = moves.find((move) => move.from === moveFrom && move.to === square);

    if (!foundMove) {
      if (piece?.pieceType.startsWith("w")) {
        const hasMoveOptions = getMoveOptions(square as Square);
        setMoveFrom(hasMoveOptions ? square : "");
      } else {
        clearSelection();
      }
      return;
    }

    const result = chessGame.move({
      from: moveFrom,
      to: square,
      promotion: "q"
    });

    if (!result) {
      clearSelection();
      return;
    }

    refreshPosition();
    playMoveSound();
    clearSelection();
  }

  function undoFullMove() {
    if (isThinking) {
      return false;
    }

    const first = chessGame.undo();
    if (!first) {
      return false;
    }

    chessGame.undo();
    refreshPosition();
    clearSelection();
    return true;
  }

  useEffect(() => {
    setIsMounted(true);
    setSoundEnabled(loadSettings().soundEnabled);
  }, []);

  useEffect(() => {
    if (!isMounted || chessGame.turn() !== "b" || chessGame.isGameOver()) {
      return;
    }

    setIsThinking(true);

    const timer = setTimeout(() => {
      const move = selectBestMove(chessGame, 3);
      if (move) {
        chessGame.move(move);
        playMoveSound();
      }

      refreshPosition();
      setIsThinking(false);
    }, 320);

    return () => clearTimeout(timer);
  }, [chessPosition, chessGame, isMounted]);

  const turnLabel = chessGame.isGameOver()
    ? "Game Over"
    : chessGame.turn() === "w"
      ? "Your Turn"
      : "AI's Turn";

  const chessboardOptions: ChessboardOptions = {
    allowDragging: false,
    onSquareClick,
    position: chessPosition,
    squareStyles: optionSquares,
    id: "little-knights"
  };

  const undoSteps = Math.floor(chessGame.history().length / 2);

  function toggleSound() {
    const nextValue = !soundEnabled;
    setSoundEnabled(nextValue);
    const settings = loadSettings();
    saveSettings({ ...settings, soundEnabled: nextValue });
    return true;
  }

  return (
    <section className="lk-shell">
      <ChessHeader turnLabel={turnLabel} />
      <PlayerRow />
      <CapturedTray
        capturedByWhite={captureState.capturedByWhite}
        capturedByBlack={captureState.capturedByBlack}
      />
      <button className="lk-sound-toggle" onClick={toggleSound} type="button">
        Sound: {soundEnabled ? "On" : "Off"}
      </button>

      <div className="lk-board-wrap">
        {isMounted ? <Chessboard options={chessboardOptions} /> : <div className="lk-board-placeholder" />}
      </div>

      <UndoControl disabled={undoSteps === 0 || isThinking} onUndo={undoFullMove} steps={undoSteps} />
    </section>
  );
}
