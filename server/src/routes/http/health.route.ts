import { Router } from "express";
import { getHealth } from "../../handlers/http/health.handler.js";

export const healthRouter = Router();

healthRouter.get("/health", getHealth);
