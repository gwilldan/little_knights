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
    <main className="lk-app-background flex min-h-dvh items-center justify-center p-6">
      <div className="mx-auto w-[min(92vw,430px)]">
        <h1
          className="mb-5 mt-0 uppercase font-extrabold tracking-[0.04em] text-[#ebcc8b]"
          style={{
            fontSize: "clamp(3rem, 10vw, 6rem)",
            textShadow: "0 2px 0 #8f5f2a, 0 8px 20px rgba(0, 0, 0, 0.4)",
          }}
        >
          Options
        </h1>

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
