import { Router } from "express";
import { getHealth } from "../../handlers/http/health.handler";

export const healthRouter = Router();

healthRouter.get("/health", getHealth);
