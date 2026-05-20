import type { Chess, PieceSymbol } from "chess.js";

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000
};

type MoveLike = string | { from: string; to: string; promotion?: string };

function evaluateBoard(game: Chess) {
  const board = game.board();
  let score = 0;

  for (const row of board) {
    for (const square of row) {
      if (!square) {
        continue;
      }

      const value = PIECE_VALUES[square.type];
      score += square.color === "b" ? value : -value;
    }
  }

  // Add a small mobility term so AI prefers active positions.
  const turn = game.turn();
  const mobility = game.moves().length;
  score += turn === "b" ? mobility * 2 : -mobility * 2;

  return score;
}

function search(game: Chess, depth: number, alpha: number, beta: number, maximizing: boolean): number {
  if (depth === 0 || game.isGameOver()) {
    if (game.isCheckmate()) {
      return maximizing ? -999999 : 999999;
    }

    return evaluateBoard(game);
  }

  const legalMoves = game.moves();

  if (maximizing) {
    let best = -Infinity;
    for (const move of legalMoves) {
      game.move(move);
      const score = search(game, depth - 1, alpha, beta, false);
      game.undo();
      best = Math.max(best, score);
      alpha = Math.max(alpha, score);
      if (beta <= alpha) {
        break;
      }
    }
    return best;
  }

  let best = Infinity;
  for (const move of legalMoves) {
    game.move(move);
    const score = search(game, depth - 1, alpha, beta, true);
    game.undo();
    best = Math.min(best, score);
    beta = Math.min(beta, score);
    if (beta <= alpha) {
      break;
    }
  }
  return best;
}

export function selectBestMove(game: Chess, depth = 3): MoveLike | null {
  const legalMoves = game.moves();
  if (legalMoves.length === 0) {
    return null;
  }

  let bestScore = -Infinity;
  let bestMove: MoveLike | null = null;

  for (const move of legalMoves) {
    game.move(move);
    const score = search(game, depth - 1, -Infinity, Infinity, false);
    game.undo();

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}
