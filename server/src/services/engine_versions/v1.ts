import type { Chess, PieceSymbol } from "chess.js";

// ═══════════════════════════════════════════════════════════════
// PIECE VALUES (centipawns)
// ═══════════════════════════════════════════════════════════════

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// ═══════════════════════════════════════════════════════════════
// PIECE-SQUARE TABLES
// Written from black's perspective (index 0 = a8 = black's back rank).
// White pieces mirror rank index via tableIndex().
// ═══════════════════════════════════════════════════════════════

const PAWN_MG: number[] = [
   0,  0,  0,  0,  0,  0,  0,  0,
  98,134, 61, 95, 68,126, 34,-11,
  -6,  7, 26, 31, 65, 56, 25,-20,
 -14, 13,  6, 21, 23, 12, 17,-23,
 -27, -2, -5, 12, 17,  6, 10,-25,
 -26, -4, -4,-10,  3,  3, 33,-12,
 -35, -1,-20,-23,-15, 24, 38,-22,
   0,  0,  0,  0,  0,  0,  0,  0,
];

const PAWN_EG: number[] = [
   0,  0,  0,  0,  0,  0,  0,  0,
 178,173,158,134,147,132,165,187,
  94,100, 85, 67, 56, 53, 82, 84,
  32, 24, 13,  5, -2,  4, 17, 17,
  13,  9, -3, -7, -7, -8,  3, -1,
   4,  7, -6,  1,  0, -5, -1, -8,
  13,  8,  8, 10, 13,  0,  2, -7,
   0,  0,  0,  0,  0,  0,  0,  0,
];

const KNIGHT_MG: number[] = [
 -167,-89,-34,-49, 61,-97,-15,-107,
  -73,-41, 72, 36, 23, 62,  7, -17,
  -47, 60, 37, 65, 84,129, 73,  44,
   -9, 17, 19, 53, 37, 69, 18,  22,
  -13,  4, 16, 13, 28, 19, 21,  -8,
  -23, -9, 12, 10, 19, 17, 25, -16,
  -29,-53,-12, -3, -1, 18,-14, -19,
 -105,-21,-58,-33,-17,-28,-19, -23,
];

const KNIGHT_EG: number[] = [
  -58,-38,-13,-28,-31,-27,-63,-99,
  -25, -8,-25, -2, -9,-25,-24,-52,
  -24,-20, 10,  9, -1, -9,-19,-41,
  -17,  3, 22, 22, 22, 11,  8,-18,
  -18, -6, 16, 25, 16, 17,  4,-18,
  -23, -3, -1, 15, 10, -3,-20,-22,
  -42,-20,-10, -5, -2,-20,-23,-44,
  -29,-51,-23,-15,-22,-18,-50,-64,
];

const BISHOP_MG: number[] = [
  -29,  4,-82,-37,-25,-42,  7, -8,
  -26, 16,-18,-13, 30, 59, 18,-47,
  -16, 37, 43, 40, 35, 50, 37, -2,
   -4,  5, 19, 50, 37, 37,  7, -2,
   -6, 13, 13, 26, 34, 12, 10,  4,
    0, 15, 15, 15, 14, 27, 18, 10,
    4, 15, 16,  0,  7, 21, 33,  1,
  -33, -3,-14,-21,-13,-12,-39,-21,
];

const BISHOP_EG: number[] = [
  -14,-21,-11, -8, -7, -9,-17,-24,
   -8, -4,  7,-12, -3,-13, -4,-14,
    2, -8,  0, -1, -2,  6,  0,  4,
   -3,  9, 12,  9, 14, 10,  3,  2,
   -6,  3, 13, 19,  7, 10, -3, -9,
  -12, -3,  8, 10, 13,  3, -7,-15,
  -14,-18, -7, -1,  4, -9,-15,-27,
  -23, -9,-23, -5, -9,-16, -5,-17,
];

const ROOK_MG: number[] = [
   32, 42, 32, 51, 63,  9, 31, 43,
   27, 32, 58, 62, 80, 67, 26, 44,
   -5, 19, 26, 36, 17, 45, 61, 16,
  -24,-11,  7, 26, 24, 35, -8,-20,
  -36,-26,-12, -1,  9, -7,  6,-23,
  -45,-25,-16,-17,  3,  0, -5,-33,
  -44,-16,-20, -9, -1, 11, -6,-71,
  -19,-13,  1, 17, 16,  7,-37,-26,
];

const ROOK_EG: number[] = [
   13, 10, 18, 15, 12, 12,  8,  5,
   11, 13, 13, 11, -3,  3,  8,  3,
    7,  7,  7,  5,  4, -3, -5, -3,
    4,  3, 13,  1,  2,  1, -1,  2,
    3,  5,  8,  4, -5, -6, -8, -11,
   -4,  0, -5, -1, -7,-12, -8,-16,
   -6, -6,  0,  2, -9, -9,-11, -3,
   -9,  2,  3, -1, -5,-13,  4,-20,
];

const QUEEN_MG: number[] = [
  -28,  0, 29, 12, 59, 44, 43, 45,
  -24,-39, -5,  1,-16, 57, 28, 54,
  -13,-17,  7,  8, 29, 56, 47, 57,
  -27,-27,-16,-16, -1, 17, -2,  1,
   -9,-26, -9,-10, -2, -4,  3, -3,
  -14,  2,-11, -2, -5,  2, 14,  5,
  -35, -8, 11,  2,  8, 15, -3,  1,
   -1,-18, -9, 10,-15,-25,-31,-50,
];

const QUEEN_EG: number[] = [
   -9, 22, 22, 27, 27, 19, 10, 20,
  -17, 20, 32, 41, 58, 25, 30,  0,
  -20,  6,  9, 49, 47, 35, 19,  9,
    3, 22, 24, 45, 57, 40, 57, 36,
  -18, 28, 19, 47, 31, 34, 39, 23,
  -16,-27, 15,  6,  9, 17, 10,  5,
  -22,-23,-30,-16,-16,-23,-36,-32,
  -33,-28,-22,-43, -5,-32,-20,-41,
];

const KING_MG: number[] = [
  -65, 23, 16,-15,-56,-34,  2, 13,
   29, -1,-20, -7, -8, -4,-38,-29,
   -9, 24,  2,-16,-20,  6, 22,-22,
  -17,-20,-12,-27,-30,-25,-14,-36,
  -49, -1,-27,-39,-46,-44,-33,-51,
  -14,-14,-22,-46,-44,-30,-15,-27,
    1,  7, -8,-64,-43,-16,  9,  8,
  -15, 36, 12,-54,  8,-28, 24, 14,
];

const KING_EG: number[] = [
  -74,-35,-18,-18,-11, 15,  4,-17,
  -12, 17, 14, 17, 17, 38, 23, 11,
   10, 17, 23, 15, 20, 45, 44, 13,
   -8, 22, 24, 27, 26, 33, 26,  3,
  -18, -4, 21, 24, 27, 23,  9,-11,
  -19, -3, 11, 21, 23, 16,  7, -9,
  -27,-11,  4, 13, 14,  4, -5,-17,
  -53,-34,-21,-11,-28,-14,-24,-43,
];

// ═══════════════════════════════════════════════════════════════
// TRANSPOSITION TABLE
// ═══════════════════════════════════════════════════════════════

const enum TTFlag { EXACT = 0, LOWER = 1, UPPER = 2 }

interface TTEntry {
  score: number;
  depth: number;
  flag: TTFlag;
  bestMove: string | null;
}

const TT_SIZE = 1_000_000;
const transpositionTable = new Map<string, TTEntry>();

function ttGet(key: string): TTEntry | undefined {
  return transpositionTable.get(key);
}

function ttSet(key: string, entry: TTEntry): void {
  if (transpositionTable.size >= TT_SIZE) {
    const firstKey = transpositionTable.keys().next().value;
    if (firstKey !== undefined) transpositionTable.delete(firstKey);
  }
  transpositionTable.set(key, entry);
}

// ═══════════════════════════════════════════════════════════════
// KILLER MOVES & HISTORY HEURISTIC
// Killer: remember 2 quiet moves per depth that caused a beta cutoff.
// History: accumulate score for [piece][toSquare] moves that raised alpha.
// Both help order quiet moves better without making actual moves.
// ═══════════════════════════════════════════════════════════════

const MAX_DEPTH = 64;
// killers[ply][0|1] = move SAN
const killers: (string | null)[][] = Array.from({ length: MAX_DEPTH }, () => [null, null]);

// history[color][fromSq][toSq] — just use a flat Map keyed by "color:from:to"
const historyTable = new Map<string, number>();

function historyKey(color: string, from: string, to: string): string {
  return `${color}:${from}:${to}`;
}

function getHistory(color: string, from: string, to: string): number {
  return historyTable.get(historyKey(color, from, to)) ?? 0;
}

function addHistory(color: string, from: string, to: string, depth: number): void {
  const key = historyKey(color, from, to);
  historyTable.set(key, (historyTable.get(key) ?? 0) + depth * depth);
}

function addKiller(ply: number, move: string): void {
  const k = killers[ply];
  if (!k) return;
  if (k[0] !== move) {
    k[1] = k[0] || "";
    k[0] = move;
  }
}

function isKiller(ply: number, move: string): boolean {
  const k = killers[ply];
  return !!k && (k[0] === move || k[1] === move);
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function tableIndex(rankIdx: number, fileIdx: number, color: "w" | "b"): number {
  return color === "w"
    ? (7 - rankIdx) * 8 + fileIdx
    : rankIdx * 8 + fileIdx;
}

/**
 * Returns a 0–1 game phase value.
 * 0 = pure opening/middlegame, 1 = pure endgame.
 * Used to interpolate between MG and EG tables.
 */
function gamePhase(game: Chess): number {
  const board = game.board();
  // Max material (both sides combined, excluding kings and pawns)
  const MG_LIMIT = 2 * (2 * 320 + 2 * 330 + 2 * 500 + 900); // ~5100
  let material = 0;
  for (const row of board) {
    for (const sq of row) {
      if (!sq || sq.type === "k" || sq.type === "p") continue;
      material += PIECE_VALUES[sq.type];
    }
  }
  // phase → 0 when material is high (middlegame), 1 when low (endgame)
  return Math.max(0, Math.min(1, 1 - material / MG_LIMIT));
}

function isEndgame(phase: number): boolean {
  return phase > 0.6;
}

// ═══════════════════════════════════════════════════════════════
// PAWN STRUCTURE EVALUATION
// Rewards passed pawns, penalises doubled/isolated pawns.
// ═══════════════════════════════════════════════════════════════

function evalPawnStructure(game: Chess): number {
  const board = game.board();
  // Track pawn files per colour
  const bPawnFiles: number[] = [];
  const wPawnFiles: number[] = [];
  // Track pawn ranks per file per colour for passed-pawn detection
  const bPawnRanks: number[][] = Array.from({ length: 8 }, () => []); // indexed by file
  const wPawnRanks: number[][] = Array.from({ length: 8 }, () => []);

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const sq = board[r]?.[f];
      if (!sq || sq.type !== "p") continue;
      if (sq.color === "b") {
        bPawnFiles.push(f);
        bPawnRanks[f]!.push(r);
      } else {
        wPawnFiles.push(f);
        wPawnRanks[f]!.push(r);
      }
    }
  }

  let score = 0;

  // ── Doubled pawns (penalty per extra pawn on same file) ──
  for (let f = 0; f < 8; f++) {
    const bd = (bPawnRanks[f]?.length ?? 0) - 1;
    const wd = (wPawnRanks[f]?.length ?? 0) - 1;
    if (bd > 0) score -= bd * 20;
    if (wd > 0) score += wd * 20;
  }

  // ── Isolated pawns (no friendly pawn on adjacent files) ──
  for (let f = 0; f < 8; f++) {
    const hasLeft  = f > 0;
    const hasRight = f < 7;

    if ((bPawnRanks[f]?.length ?? 0) > 0) {
      const isolated =
        (!hasLeft  || (bPawnRanks[f - 1]?.length ?? 0) === 0) &&
        (!hasRight || (bPawnRanks[f + 1]?.length ?? 0) === 0);
      if (isolated) score -= 15 * (bPawnRanks[f]?.length ?? 0);
    }

    if ((wPawnRanks[f]?.length ?? 0) > 0) {
      const isolated =
        (!hasLeft  || (wPawnRanks[f - 1]?.length ?? 0) === 0) &&
        (!hasRight || (wPawnRanks[f + 1]?.length ?? 0) === 0);
      if (isolated) score += 15 * (wPawnRanks[f]?.length ?? 0);
    }
  }

  // ── Passed pawns (no opposing pawn can stop them) ──
  // Black passed pawn: no white pawn on same or adjacent files with lower rank (closer to rank 1)
  for (let f = 0; f < 8; f++) {
    for (const r of (bPawnRanks[f] ?? [])) {
      // Black advances toward rank 7 (higher r index = closer to promotion for black... wait:
      // board[0] = rank 8, board[7] = rank 1. Black promotes at rank 1 (r=7).
      // A black pawn at r is "passed" if no white pawn exists on files f-1..f+1 at ranks > r.
      let passed = true;
      for (let af = Math.max(0, f - 1); af <= Math.min(7, f + 1); af++) {
        for (const wr of (wPawnRanks[af] ?? [])) {
          if (wr > r) { passed = false; break; }
        }
        if (!passed) break;
      }
      if (passed) {
        // Bonus grows as the pawn advances (r closer to 7 = more advanced for black)
        score += 20 + r * 10;
      }
    }

    for (const r of (wPawnRanks[f] ?? [])) {
      // White promotes at rank 8 (r=0). White pawn at r is passed if no black pawn
      // on adjacent files at ranks < r.
      let passed = true;
      for (let af = Math.max(0, f - 1); af <= Math.min(7, f + 1); af++) {
        for (const br of (bPawnRanks[af] ?? [])) {
          if (br < r) { passed = false; break; }
        }
        if (!passed) break;
      }
      if (passed) {
        score -= 20 + (7 - r) * 10;
      }
    }
  }

  return score;
}

// ═══════════════════════════════════════════════════════════════
// KING SAFETY
// Penalises an exposed king (few pawns in front of it).
// ═══════════════════════════════════════════════════════════════

function evalKingSafety(game: Chess, phase: number): number {
  if (isEndgame(phase)) return 0; // King safety matters less in endgames
  const board = game.board();
  let score = 0;

  // Find kings
  let bKingFile = -1, bKingRank = -1;
  let wKingFile = -1, wKingRank = -1;

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const sq = board[r]?.[f];
      if (!sq || sq.type !== "k") continue;
      if (sq.color === "b") { bKingRank = r; bKingFile = f; }
      else                  { wKingRank = r; wKingFile = f; }
    }
  }

  // Count pawn shield squares in front of king
  const countShield = (kingRank: number, kingFile: number, color: "b" | "w"): number => {
    let shields = 0;
    const direction = color === "b" ? 1 : -1; // black king shields at higher ranks
    for (let f = Math.max(0, kingFile - 1); f <= Math.min(7, kingFile + 1); f++) {
      const shieldRank = kingRank + direction;
      if (shieldRank < 0 || shieldRank > 7) continue;
      const sq = board[shieldRank]?.[f];
      if (sq?.type === "p" && sq.color === color) shields++;
    }
    return shields;
  };

  if (bKingFile >= 0) {
    const shield = countShield(bKingRank, bKingFile, "b");
    score += (shield - 3) * 15; // penalty for missing pawns
  }
  if (wKingFile >= 0) {
    const shield = countShield(wKingRank, wKingFile, "w");
    score -= (shield - 3) * 15;
  }

  return score;
}

// ═══════════════════════════════════════════════════════════════
// BOARD EVALUATION  (tapered: interpolates MG ↔ EG tables)
// Score is from BLACK's POV: positive = black better, negative = white better.
// ═══════════════════════════════════════════════════════════════

const MG_TABLES: Record<PieceSymbol, number[]> = {
  p: PAWN_MG, n: KNIGHT_MG, b: BISHOP_MG,
  r: ROOK_MG, q: QUEEN_MG,  k: KING_MG,
};
const EG_TABLES: Record<PieceSymbol, number[]> = {
  p: PAWN_EG, n: KNIGHT_EG, b: BISHOP_EG,
  r: ROOK_EG, q: QUEEN_EG,  k: KING_EG,
};

function evaluateBoard(game: Chess): number {
  const phase = gamePhase(game);
  const board = game.board();

  let score = 0;
  let whiteBishops = 0, blackBishops = 0;

  for (let rankIdx = 0; rankIdx < 8; rankIdx++) {
    for (let fileIdx = 0; fileIdx < 8; fileIdx++) {
      const sq = board[rankIdx]?.[fileIdx];
      if (sq == null) continue;

      const value = PIECE_VALUES[sq.type];
      const idx   = tableIndex(rankIdx, fileIdx, sq.color);

      // Taper between middlegame and endgame tables
      const mgBonus = MG_TABLES[sq.type][idx] ?? 0;
      const egBonus = EG_TABLES[sq.type][idx] ?? 0;
      const positional = mgBonus * (1 - phase) + egBonus * phase;

      const total = value + positional;
      score += sq.color === "b" ? total : -total;

      if (sq.type === "b") {
        if (sq.color === "b") blackBishops++;
        else whiteBishops++;
      }
    }
  }

  // Bishop pair
  if (blackBishops >= 2) score += 30;
  if (whiteBishops >= 2) score -= 30;

  // Pawn structure
  score += evalPawnStructure(game);

  // King safety
  score += evalKingSafety(game, phase);

  return score;
}

// ═══════════════════════════════════════════════════════════════
// MOVE ORDERING
// Priority: TT best > checkmate > captures (MVV-LVA) > promotions
//         > killer moves > history heuristic > quiet
// ═══════════════════════════════════════════════════════════════

function orderMoves(
  game: Chess,
  moves: string[],
  ply: number,
  ttBestMove: string | null = null
): string[] {
  const verboseMoves = game.moves({ verbose: true });
  const verboseMap   = new Map(verboseMoves.map((m) => [m.san, m]));

  const scored = moves.map((move) => {
    if (move === ttBestMove) return { move, score: 10_000_000 };

    let s = 0;
    const vm = verboseMap.get(move);

    // MVV-LVA
    if (vm?.captured) {
      const victim   = PIECE_VALUES[vm.captured  as PieceSymbol] ?? 0;
      const attacker = PIECE_VALUES[vm.piece     as PieceSymbol] ?? 0;
      s += 1_000_000 + victim * 10 - attacker;
    }

    // Promotions
    if (vm?.promotion) {
      s += 900_000 + (PIECE_VALUES[vm.promotion as PieceSymbol] ?? 0);
    }

    // Killer moves (quiet moves that caused cutoffs at this ply)
    if (!vm?.captured && isKiller(ply, move)) {
      s += 800_000;
    }

    // Checks
    if (!vm?.captured) {
      game.move(move);
      if (game.isCheckmate()) { game.undo(); return { move, score: 9_000_000 }; }
      if (game.inCheck())     s += 700_000;
      game.undo();
    }

    // History heuristic for quiet moves
    if (!vm?.captured && vm) {
      s += getHistory(vm.color, vm.from, vm.to);
    }

    return { move, score: s };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map((m) => m.move);
}

// ═══════════════════════════════════════════════════════════════
// QUIESCENCE SEARCH  (with delta pruning)
// ═══════════════════════════════════════════════════════════════

function quiescence(game: Chess, alpha: number, beta: number, maximizing: boolean): number {
  const standPat = evaluateBoard(game);

  if (maximizing) {
    if (standPat >= beta) return beta;
    if (standPat < alpha - 200 - PIECE_VALUES.q) return alpha; // delta pruning
    if (standPat > alpha) alpha = standPat;
  } else {
    if (standPat <= alpha) return alpha;
    if (standPat > beta + 200 + PIECE_VALUES.q) return beta;
    if (standPat < beta) beta = standPat;
  }

  const captures = game
    .moves({ verbose: true })
    .filter((m) => m.captured || m.promotion)
    .map((m) => m.san);

  for (const move of captures) {
    game.move(move);
    const score = quiescence(game, alpha, beta, !maximizing);
    game.undo();

    if (maximizing) {
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    } else {
      if (score <= alpha) return alpha;
      if (score < beta) beta = score;
    }
  }

  return maximizing ? alpha : beta;
}

// ═══════════════════════════════════════════════════════════════
// SEARCH  (negamax-style alpha-beta with all pruning techniques)
//
// New in this version:
//   • Late Move Reductions (LMR) — search later/quieter moves at reduced depth
//   • Futility pruning — skip moves near leaves that can't improve alpha
//   • Razoring — drop straight to quiescence if static eval is very low
//   • Killer + history heuristic for quiet-move ordering
// ═══════════════════════════════════════════════════════════════

const LMR_MIN_DEPTH  = 3;   // Only reduce when depth >= this
const LMR_FULL_MOVES = 3;   // Search first N moves at full depth before reducing
const FUTILITY_MARGIN = [0, 100, 200, 300]; // indexed by depth (0-3)

function search(
  game: Chess,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  ply: number,
  allowNullMove: boolean = true
): number {
  const originalAlpha = alpha;
  const fen = game.fen();

  // ── TT lookup ──
  const ttEntry = ttGet(fen);
  if (ttEntry && ttEntry.depth >= depth) {
    if (ttEntry.flag === TTFlag.EXACT) return ttEntry.score;
    if (ttEntry.flag === TTFlag.LOWER) alpha = Math.max(alpha, ttEntry.score);
    if (ttEntry.flag === TTFlag.UPPER) beta  = Math.min(beta,  ttEntry.score);
    if (alpha >= beta) return ttEntry.score;
  }

  // ── Terminal ──
  if (game.isGameOver()) {
    if (game.isCheckmate()) return maximizing ? -999999 + ply : 999999 - ply;
    return 0;
  }

  // ── Leaf → quiescence ──
  if (depth === 0) return quiescence(game, alpha, beta, maximizing);

  const staticEval = evaluateBoard(game);
  const phase = gamePhase(game);
  const inCheck = game.inCheck();

  // ── Razoring (at depth 1-2, if static eval is way below alpha, drop to qsearch) ──
  if (!inCheck && depth <= 2 && !isEndgame(phase)) {
    const razor_margin = depth === 1 ? 300 : 600;
    const razorEval = maximizing ? staticEval : -staticEval;
    if (razorEval + razor_margin < alpha) {
      return quiescence(game, alpha, beta, maximizing);
    }
  }

  // ── Null move pruning ──
  if (allowNullMove && !inCheck && !isEndgame(phase) && depth >= 3) {
    const R = depth > 6 ? 3 : 2;
    const nullScore = -search(game, depth - R - 1, -beta, -beta + 1, !maximizing, ply + 1, false);
    if (nullScore >= beta) return beta;
  }

  // ── Futility pruning (skip quiet moves near leaves if they can't raise alpha) ──
  const futilityMargin = FUTILITY_MARGIN[Math.min(depth, 3)] ?? 300;
  const canFutilityPrune =
    !inCheck &&
    depth <= 3 &&
    (maximizing ? staticEval + futilityMargin <= alpha : -staticEval + futilityMargin <= alpha);

  // ── Recurse ──
  const ttBestMove  = ttEntry?.bestMove ?? null;
  const legalMoves  = orderMoves(game, game.moves(), ply, ttBestMove);
  let bestScore     = maximizing ? -Infinity : Infinity;
  let bestMove: string | null = null;
  let movesSearched = 0;

  for (const move of legalMoves) {
    const vm = game.moves({ verbose: true }).find((m) => m.san === move);
    const isCapture   = !!vm?.captured;
    const isPromotion = !!vm?.promotion;
    const isQuiet     = !isCapture && !isPromotion;

    // Futility pruning: skip quiet moves if position is hopeless
    if (canFutilityPrune && isQuiet && movesSearched > 0) continue;

    game.move(move);
    const givesCheck = game.inCheck();
    let score: number;

    // ── Late Move Reductions (LMR) ──
    // Later moves (after the first few) are searched at reduced depth.
    // If the reduced search raises alpha, re-search at full depth.
    if (
      depth >= LMR_MIN_DEPTH &&
      movesSearched >= LMR_FULL_MOVES &&
      isQuiet &&
      !givesCheck &&
      !inCheck
    ) {
      // Reduction: logarithmic based on depth and move index
      const reduction = Math.max(1, Math.floor(Math.log(depth) * Math.log(movesSearched + 1) / 2));
      const reducedDepth = Math.max(1, depth - 1 - reduction);

      // Search at reduced depth first
      score = search(game, reducedDepth, alpha, beta, !maximizing, ply + 1, true);

      // If it looks good, re-search at full depth to confirm
      if (maximizing ? score > alpha : score < beta) {
        score = search(game, depth - 1, alpha, beta, !maximizing, ply + 1, true);
      }
    } else {
      score = search(game, depth - 1, alpha, beta, !maximizing, ply + 1, true);
    }

    game.undo();
    movesSearched++;

    if (maximizing) {
      if (score > bestScore) { bestScore = score; bestMove = move; }
      if (score > alpha) {
        alpha = score;
        // Update history for quiet moves that raise alpha
        if (isQuiet && vm) addHistory(vm.color, vm.from, vm.to, depth);
      }
    } else {
      if (score < bestScore) { bestScore = score; bestMove = move; }
      if (score < beta) {
        beta = score;
        if (isQuiet && vm) addHistory(vm.color, vm.from, vm.to, depth);
      }
    }

    if (beta <= alpha) {
      // Beta cutoff: record killer move if quiet
      if (isQuiet) addKiller(ply, move);
      break;
    }
  }

  // ── Store in TT ──
  const flag: TTFlag =
    bestScore <= originalAlpha ? TTFlag.UPPER :
    bestScore >= beta          ? TTFlag.LOWER :
                                 TTFlag.EXACT;
  ttSet(fen, { score: bestScore, depth, flag, bestMove });

  return bestScore;
}

// ═══════════════════════════════════════════════════════════════
// ASPIRATION WINDOWS
// Instead of searching [-∞, +∞] each iteration, search a narrow
// window around the previous iteration's score. This causes many
// more cutoffs. If the score falls outside the window, re-search
// with a wider window (fail-soft).
// ═══════════════════════════════════════════════════════════════

const ASPIRATION_DELTA = 50; // Initial window width in centipawns

function searchWithAspiration(
  game: Chess,
  depth: number,
  prevScore: number
): { score: number; move: string | null } {
  if (depth < 4) {
    // Full window for shallow depths (aspiration not worth it)
    return searchRoot(game, depth, -Infinity, Infinity);
  }

  let delta = ASPIRATION_DELTA;
  let alpha = prevScore - delta;
  let beta  = prevScore + delta;

  while (true) {
    const result = searchRoot(game, depth, alpha, beta);

    if (result.score <= alpha) {
      // Fail low: widen alpha
      alpha = Math.max(-999999, alpha - delta);
      delta *= 2;
    } else if (result.score >= beta) {
      // Fail high: widen beta
      beta = Math.min(999999, beta + delta);
      delta *= 2;
    } else {
      return result; // Score inside window — done
    }

    // Safety: fall back to full window after too many expansions
    if (delta > 1500) {
      return searchRoot(game, depth, -Infinity, Infinity);
    }
  }
}

function searchRoot(
  game: Chess,
  depth: number,
  alpha: number,
  beta: number
): { score: number; move: string | null } {
  const ttBestMove  = ttGet(game.fen())?.bestMove ?? null;
  const legalMoves  = orderMoves(game, game.moves(), 0, ttBestMove);
  if (legalMoves.length === 0) return { score: 0, move: null };

  let bestScore = -Infinity;
  let bestMove: string | null = null;

  for (const move of legalMoves) {
    game.move(move);
    // Bot plays black → maximizing at root. After black moves it's white's turn → !maximizing
    const score = search(game, depth - 1, alpha, beta, false, 1, true);
    game.undo();

    if (score > bestScore) {
      bestScore = score;
      bestMove  = move;
    }
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }

  return { score: bestScore, move: bestMove };
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API  —  iterative deepening + aspiration windows
// ═══════════════════════════════════════════════════════════════

/**
 * Select the best move for black.
 *
 * @param game        - chess.js Chess instance (bot always plays black)
 * @param timeLimitMs - Think-time budget in ms  (default: 3000)
 * @param maxDepth    - Hard depth ceiling        (default: 16)
 */
export function selectBestMove(
  game: Chess,
  timeLimitMs = 3000,
  maxDepth = 16
): string | null {
  const start = Date.now();

  // Reset per-move state
  transpositionTable.clear();
  historyTable.clear();
  for (let i = 0; i < MAX_DEPTH; i++) {
    killers[i] = [null, null];
  }

  let bestMove: string | null = null;
  let prevScore = 0;

  for (let depth = 1; depth <= maxDepth; depth++) {
    if (Date.now() - start > timeLimitMs * 0.8) break;

    const { score, move } = searchWithAspiration(game, depth, prevScore);
    if (move) bestMove = move;
    prevScore = score;

    console.log(
      `[chess-engine] depth=${depth} score=${score} move=${bestMove} time=${Date.now() - start}ms`
    );

    // If we found a forced mate, no need to search deeper
    if (Math.abs(score) > 900000) break;
  }

  return bestMove;
}