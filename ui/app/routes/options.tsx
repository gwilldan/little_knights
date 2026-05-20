import { useEffect, useState } from "react";
import { Link } from "react-router";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type AppSettings } from "~/utils/settings";

export default function OptionsRoute() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  function updateSetting<Key extends keyof AppSettings>(key: Key, value: AppSettings[Key]) {
    const next = { ...settings, [key]: value };
    setSettings(next);
    saveSettings(next);
  }

  return (
    <main className="lk-menu-screen">
      <div className="lk-menu-panel">
        <h1 className="lk-menu-title">Options</h1>

        <section className="lk-options-list">
          <label className="lk-option-row">
            <span>Sound</span>
            <input
              checked={settings.soundEnabled}
              onChange={(event) => updateSetting("soundEnabled", event.target.checked)}
              type="checkbox"
            />
          </label>

          <label className="lk-option-row">
            <span>Show Legal Moves</span>
            <input
              checked={settings.showLegalMoves}
              onChange={(event) => updateSetting("showLegalMoves", event.target.checked)}
              type="checkbox"
            />
          </label>

          <label className="lk-option-row">
            <span>Auto Promote To Queen</span>
            <input
              checked={settings.autoPromoteToQueen}
              onChange={(event) => updateSetting("autoPromoteToQueen", event.target.checked)}
              type="checkbox"
            />
          </label>

          <label className="lk-option-row">
            <span>Flip Board</span>
            <input
              checked={settings.boardFlipped}
              onChange={(event) => updateSetting("boardFlipped", event.target.checked)}
              type="checkbox"
            />
          </label>

          <label className="lk-option-row lk-option-row-stack">
            <span>WebSocket URL</span>
            <input
              className="lk-option-input"
              onChange={(event) => updateSetting("wsUrl", event.target.value)}
              type="text"
              value={settings.wsUrl}
            />
          </label>
        </section>

        <Link className="lk-menu-button" to="/">
          Back
        </Link>
      </div>
    </main>
  );
}
