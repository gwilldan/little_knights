export type ChessHeaderProps = {
  turnLabel: string;
};

export default function ChessHeader({ turnLabel }: ChessHeaderProps) {
  return (
    <header className="lk-header">
      <h1 className="lk-title">Little Knights</h1>
      <p className="lk-subtitle">{turnLabel}</p>
    </header>
  );
}
