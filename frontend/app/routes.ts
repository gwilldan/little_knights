import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route(".well-known/appspecific/com.chrome.devtools.json", "routes/well-known.chrome-devtools.ts"),
  route("single/play", "routes/single.play.tsx"),
  route("single", "routes/single.tsx"),
  route("multiplayer/:roomId", "routes/multiplayer.room.tsx"),
  route("multiplayer", "routes/multiplayer.tsx"),
  route("profile", "routes/profile.tsx"),
  route("options", "routes/options.tsx"),
] satisfies RouteConfig;
