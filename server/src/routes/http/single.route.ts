import { Router } from "express";
import { saveSingleGame } from "../../handlers/http/single.handler";

export const singleRouter = Router();

singleRouter.post("/game/single", saveSingleGame);
