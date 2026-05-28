function timestamp() {
  return new Date().toISOString();
}

function shortId(value: string | null | undefined) {
  if (!value) return null;
  return value.length > 14 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}

export function logAppEvent(event: string, details: Record<string, unknown> = {}) {
  console.info(`[${timestamp()}] ${event}`, details);
}

export { shortId };
