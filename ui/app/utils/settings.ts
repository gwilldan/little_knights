export type AppSettings = {
  soundEnabled: boolean;
  showLegalMoves: boolean;
  autoPromoteToQueen: boolean;
  boardFlipped: boolean;
  wsUrl: string;
};

const SETTINGS_KEY = "little-knights-settings";
const WS_URL = process.env.NODE_ENV === "production" ? "wss://api.chess.gwilldan.xyz" : "ws://localhost:8080";

export const DEFAULT_SETTINGS: AppSettings = {
  soundEnabled: true,
  showLegalMoves: true,
  autoPromoteToQueen: true,
  boardFlipped: false,
  wsUrl: WS_URL
};

export function loadSettings() {
  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS;
  }

  const raw = window.localStorage.getItem(SETTINGS_KEY);
  if (!raw) {
    return DEFAULT_SETTINGS;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings) {
  if (typeof window === "undefined") {
    return false;
  }

  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  return true;
}
