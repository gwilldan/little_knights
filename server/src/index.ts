import "dotenv/config";
import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import { registerGameSocketRoutes } from "./routes/ws/game.ws";
import { connectRedis } from "./services/redis.service";
import { pg } from "./db/db.init";
import { healthRouter, singleRouter, userRouter } from "./routes/http";

const PORT = Number(process.env.PORT || 8080);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:5173";

async function bootstrap(): Promise<void> {
  await connectRedis();
  await pg.connect();

  const app = express();

  // middlewares
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", CORS_ORIGIN);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }

    next();
  });
  app.use(express.json());

  // routers
  app.use(userRouter);
  app.use(healthRouter);
  app.use(singleRouter);

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  registerGameSocketRoutes(wss);

  server.listen(PORT, () => {
    console.log(`Chess socket server listening on http://localhost:${PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to boot server", error);
  process.exit(1);
});
