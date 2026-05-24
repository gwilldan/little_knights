import { API_URL } from "../constants";

type SaveSingleGamePayload = {
  roomId: string;
  gameId: string;
  txHash: string;
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
