const API_URL = process.env.NODE_ENV === "production" ? "https://api.chess.gwilldan.xyz" : "http://localhost:8080";

type SaveSingleGamePayload = {
  gameId: string;
  txHash: string;
  walletAddress: string;
  betAmount: string;
  uid: string;
};

export async function saveSingleGame(payload: SaveSingleGamePayload) {
  const response = await fetch(`${API_URL}/game/single`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return response.ok;
}
