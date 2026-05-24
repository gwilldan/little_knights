import { keccak256, toBytes } from "viem";

const UID_KEY = "little-knights-uid";

export function getOrCreateUid(walletAddress?: string | null) {
  if (typeof window === "undefined") {
    return "guest-server";
  }

  const walletKey = walletAddress?.toLowerCase() ?? "guest-wallet";
  const scopedKey = `${UID_KEY}:${walletKey}`;

  const existing = window.localStorage.getItem(scopedKey);
  if (existing) {
    return existing;
  }

  const generated = keccak256(toBytes(`${walletKey}-${Date.now()}`));
  window.localStorage.setItem(scopedKey, generated);
  return generated;
}
