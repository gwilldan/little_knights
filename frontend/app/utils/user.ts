const UID_KEY = "little-knights-uid";

export function getOrCreateUid() {
  if (typeof window === "undefined") {
    return "guest-server";
  }

  const existing = window.localStorage.getItem(UID_KEY);
  if (existing) {
    return existing;
  }

  const generated = `uid-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(UID_KEY, generated);
  return generated;
}
