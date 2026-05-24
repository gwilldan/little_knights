import { Router } from "express";
import { auth } from "../../handlers/auth.middleware";
import { saveSingleGame } from "../../handlers/http/single.handler";

export const singleRouter = Router();

singleRouter.post("/game/single", auth, saveSingleGame);
