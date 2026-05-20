import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import { healthRouter } from "./routes/http/health.route.js";
import { registerGameSocketRoutes } from "./routes/ws/game.ws.js";

const PORT = Number(process.env.PORT || 8080);

const app = express();
app.use(healthRouter);

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

registerGameSocketRoutes(wss);

server.listen(PORT, () => {
  console.log(`Chess socket server listening on http://localhost:${PORT}`);
});
