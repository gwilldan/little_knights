import { Navigate } from "react-router";

export default function MultiplayerFallbackRoute() {
  return <Navigate to="/single/play" replace />;
}
