import { Router } from "express";
import { getHealth } from "../handlers/http/health.handler";
import { auth } from "../handlers/auth.middleware";
import { saveSingleGame } from "../handlers/http/single.handler";
import { getUser, signInUser } from "../handlers/http/users.handler";

// health check endpoint
export const healthRouter = Router().get("/health", getHealth);

// singlGamee game endpoint
export const singleRouter = Router().post("/game/single", auth, saveSingleGame);

// user endpoints
export const userRouter = Router();
userRouter.route("/user").get(getUser)
userRouter.post("/user/signin", signInUser)

