import { API_URL } from "~/constants";

type SignInPayload = {
  id: string;
  name: string;
  balance: string;
};

export async function signInUser(payload: SignInPayload) {
  const response = await fetch(`${API_URL}/user/signin?id=${encodeURIComponent(payload.id)}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return response.ok;
}
