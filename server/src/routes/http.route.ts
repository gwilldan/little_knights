import { Router } from "express";
import { getHealth } from "../handlers/http/health.handler";
import { auth } from "../handlers/auth.middleware";
import { saveSingleGame } from "../handlers/http/single.handler";
import { getUser, signInUser } from "../handlers/http/users.handler";
import { getTxNonce} from "../handlers/http/redis.handler";

export const router = Router()

// health check endpoint
router.get("/health", getHealth);

// singlGamee game endpoint
router.post("/game/single", auth, saveSingleGame);

// user endpoints
router.route("/user").get(getUser)
router.post("/user/signin", signInUser)

// test 
router.route("/redis").get(getTxNonce)



