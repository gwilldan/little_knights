const API_URL = process.env.NODE_ENV === "production" ? "https://api.chess.gwilldan.xyz" : "http://localhost:8080";

export async function signInUser(userId: string) {
  const response = await fetch(`${API_URL}/user/signin?id=${encodeURIComponent(userId)}`, {
    method: "POST",
    credentials: "include"
  });

  return response.ok;
}
