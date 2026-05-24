import { Router } from "express"
import { getUser, signInUser } from "../../handlers/http/users.handler";

export const userRouter = Router();

userRouter.route("/user").get(getUser)
userRouter.post("/user/signin", signInUser)

