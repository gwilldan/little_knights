export type CapturedTrayProps = {
  capturedByWhite: string[];
  capturedByBlack: string[];
};

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
  return Object.entries(
    pieces.reduce<Record<string, number>>((acc, piece) => {
      acc[piece] = (acc[piece] ?? 0) + 1;
      return acc;
    }, {})
  );
}

export default function CapturedTray({ capturedByWhite, capturedByBlack }: CapturedTrayProps) {
  const groupedWhite = groupPieces(capturedByWhite);
  const groupedBlack = groupPieces(capturedByBlack);

  return (
    <section aria-label="Captured pieces" className="lk-captured">
      <div className="lk-captured-pieces">
        {groupedWhite.map(([piece, count]) => (
          <span className="lk-chip lk-chip-dark lk-chip-stack" key={`w-group-${piece}`}>
            {pieceToSymbol(piece, "b")}
            {count > 1 ? <small className="lk-chip-count">{count}</small> : null}
          </span>
        ))}
      </div>

      <div className="lk-captured-pieces">
        {groupedBlack.map(([piece, count]) => (
          <span className="lk-chip lk-chip-light lk-chip-stack" key={`b-group-${piece}`}>
            {pieceToSymbol(piece, "w")}
            {count > 1 ? <small className="lk-chip-count">{count}</small> : null}
          </span>
        ))}
      </div>
    </section>
  );
}
