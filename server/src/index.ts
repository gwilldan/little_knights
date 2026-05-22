import "dotenv/config"
import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import { registerGameSocketRoutes } from "./routes/ws/game.ws";
import { connectRedis } from "./services/redis.service";
import { pg } from "./utils/config/db.init";
import { healthRouter, userRouter } from "./routes/http";

const PORT = Number(process.env.PORT || 8080);

async function bootstrap(): Promise<void> {
  await connectRedis();
  await pg.connect();

  const app = express();

  // middlewares
  app.use(express.json());

  // routers
  app.use(userRouter);
  app.use(healthRouter);

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
