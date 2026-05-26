import { API_URL } from "../constants";

type SaveSingleGamePayload = {
  roomId: string;
  uid: string;
  amount: string;
  txHash: string;
};

export async function saveSingleGame(payload: SaveSingleGamePayload) {
  try {
        const response = await fetch(`${API_URL}/game/single`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    return response.ok;
  } catch (error) {
    throw error
  }
}
