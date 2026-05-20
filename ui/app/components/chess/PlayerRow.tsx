export default function PlayerRow() {
  return (
    <section aria-label="Players" className="lk-players">
      <div className="lk-player">
        <img alt="Me avatar" className="lk-avatar-img" src="/avatars/me.svg" />
        <strong>Me</strong>
      </div>

      <span className="lk-versus">vs</span>

      <div className="lk-player lk-player-right">
        <strong>AI</strong> <img alt="AI avatar" className="lk-avatar-img" src="/avatars/ai.svg" />
      </div>
    </section>
  );
}
