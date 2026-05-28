export type CapturedTrayProps = {
  pieces: string[];
  pieceColor: "w" | "b";
};

const PIECE_ORDER = ["p", "n", "b", "r", "q", "k"] as const;

function pieceToSymbol(piece: string, color: "w" | "b") {
  const whiteMap: Record<string, string> = {
    p: "♙",
    n: "♘",
    b: "♗",
    r: "♖",
    q: "♕",
    k: "♔"
  };

  const blackMap: Record<string, string> = {
    p: "♟",
    n: "♞",
    b: "♝",
    r: "♜",
    q: "♛",
    k: "♚"
  };

  return color === "w" ? whiteMap[piece] : blackMap[piece];
}

function groupPieces(pieces: string[]) {
  const counts = pieces.reduce<Record<string, number>>((acc, piece) => {
    acc[piece] = (acc[piece] ?? 0) + 1;
    return acc;
  }, {});

  return PIECE_ORDER.filter((piece) => counts[piece]).map((piece) => [piece, counts[piece]!] as const);
}

export default function CapturedTray({ pieces, pieceColor }: CapturedTrayProps) {
  const grouped = groupPieces(pieces);

  return (
    <section aria-label="Captured pieces" className="lk-captured">
      <div className="lk-captured-pieces">
        {grouped.map(([piece, count]) => (
          <span className="lk-captured-group" key={`${pieceColor}-group-${piece}`}>
            <span className={`lk-chip ${pieceColor === "w" ? "lk-chip-light" : "lk-chip-dark"}`}>
              {pieceToSymbol(piece, pieceColor)}
            </span>
            {count > 1 ? <small className="lk-chip-count">{count}</small> : null}
          </span>
        ))}
      </div>
    </section>
  );
}
