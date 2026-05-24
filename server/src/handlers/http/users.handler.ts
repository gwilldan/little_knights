import { Request, Response } from "express";
import { usersTable } from "../../db/schema";
import { db } from "../../db/db.init";
import { eq } from "drizzle-orm";
import { UserInsert, userInsert } from "../../utils/zod.config";
import {
  AUTH_COOKIE,
  AUTH_COOKIE_MAX_AGE_MS,
  signAuthToken,
} from "../../utils/auth";

export const getUser = async (req: Request, res: Response) => {
  try {
    const reqId = req.query.id as string;
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, reqId))
      .limit(1);

    if (!user) {
      res.status(401).json({ message: "user not found" });
      return;
    }
    res.json({ ...user, balance: user.balance.toString() });
  } catch (error) {
    console.log(error);
    const message = error instanceof Error ? error.message : error;
    res.status(404).json({ message });
  }
};


export const signInUser = async (req: Request, res: Response) => {
  try {

    let _user: UserInsert;

    const reqId = (req.query.id ?? req.body?.id) as string | undefined;
    if (!reqId?.trim()) {
      res.status(400).json({ message: "User id is required" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, reqId.trim()))
      .limit(1);

    // create user if not exists, otherwise use existing user
    if (!user) {
      const newUser = userInsert.parse({ ...req.body });
      await db.insert(usersTable).values(newUser);
      _user = newUser;
    } else {
      _user = user;
    }

    const token = signAuthToken(_user.id);
    res.cookie(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: AUTH_COOKIE_MAX_AGE_MS,
      path: "/",
    });

    res.json({
      id: _user.id,
      name: _user.name,
      balance: _user.balance.toString(),
    });
  } catch (error) {
    console.log("error from signInUser:", error);
    const message = error instanceof Error ? error.message : error;
    res.status(500).json({ message });
  }
};
