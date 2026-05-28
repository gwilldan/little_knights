import { Request, Response } from "express";
import { usersTable } from "../../db/schema";
import { db } from "../../db/db.init";
import { eq } from "drizzle-orm";
import { userInsert } from "../../utils/zod.config";
import {
  AUTH_COOKIE,
  AUTH_COOKIE_MAX_AGE_MS,
  signAuthToken,
} from "../../utils/auth";
import { logAppEvent, shortId } from "../../utils/appLogger";

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
    const message = error instanceof Error ? error.message : error;
    res.status(404).json({ message });
  }
};


export const signInUser = async (req: Request, res: Response) => {
  try {
    let _user: { id: string; name: string };

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
      const parsedBalance = BigInt(req.body?.balance ?? "0");
      const fallbackName = `Player-${reqId.trim().slice(2, 8)}`;
      const newUser = userInsert.parse({
        id: reqId.trim(),
        name: req.body?.name ?? fallbackName,
        balance: parsedBalance,
        joined: new Date(),
      });
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

    logAppEvent("user_login", { userId: shortId(_user.id) });

    res.json({
      id: _user.id,
      name: _user.name,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : error;
    res.status(500).json({ message });
  }
};
