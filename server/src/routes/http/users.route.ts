import { Router } from "express"
import { createUser, getUser, signInUser } from "../../handlers/http/users.handler";

export const userRouter = Router();

userRouter.route("/user").get(getUser).post(createUser)
userRouter.post("/user/signin", signInUser)

