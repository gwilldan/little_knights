export type UndoControlProps = {
  disabled: boolean;
  steps: number;
  onUndo: () => boolean;
};

export default function UndoControl({ disabled, steps, onUndo }: UndoControlProps) {
  return (
    <div className="lk-undo-wrap">
      <button className="lk-undo" onClick={onUndo} disabled={disabled} type="button" aria-label="Undo last turn">
        ↺
      </button>
      <span className="lk-undo-count">{steps}</span>
    </div>
  );
}
