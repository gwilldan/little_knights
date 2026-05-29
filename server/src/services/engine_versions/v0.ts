import type { Chess, PieceSymbol } from "chess.js";

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000
};

function evaluateBoard(game: Chess): number {
  let score = 0;

  for (const row of game.board()) {
    for (const square of row) {
      if (!square) {
        continue;
      }

      const value = PIECE_VALUES[square.type];
      score += square.color === "b" ? value : -value;
    }
  }

  const mobility = game.moves().length;
  score += game.turn() === "b" ? mobility * 2 : -mobility * 2;

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

export function selectBestMove(game: Chess, depth = 3): string | null {
  const legalMoves = game.moves();
  if (legalMoves.length === 0) {
    return null;
  }

  let bestScore = -Infinity;
  let bestMove: string | null = null;

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
