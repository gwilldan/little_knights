import { Navigate } from "react-router";

export default function SingleFallbackRoute() {
  return <Navigate to="/single/play" replace />;
}
