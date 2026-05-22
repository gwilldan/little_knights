import { Request, Response } from "express";
import { usersTable } from "../../utils/config/schema";
import { db } from "../../utils/config/db.init";
import { eq } from "drizzle-orm";
import { userInsert } from "../../utils/config/zod";

export const getUser = async (req: Request, res: Response) => {
    try {
        const reqId = req.query.id as string
        const [user] = await db.select().from(usersTable).where(eq(usersTable.id, reqId)).limit(1)

        if (!user) {
            res.status(401).json({ message: "user not found" })
            return;
        }
        res.json({ ...user, balance: user.balance.toString() })
    } catch (error) {
        console.log(error)
        const message = error instanceof Error ? error.message : error
        res.status(404).json({ message })
    }
}

export const createUser = async (req: Request, res: Response) => {
    try {
        const id = crypto.randomUUID()
        const balance = 0n
        const user = userInsert.parse({ ...req.body, id, balance })
        await db.insert(usersTable).values(user)
        res.sendStatus(201)
    } catch (error: any) {

        if (error?.cause?.code == 23505) {
            res.status(409).json({ message: `${req.body.wallet} already exist` })
            return;
        }
        console.log("full error", error)
        console.log("error options", Object.keys(error))

        const message = error instanceof Error ? error.message : error
        res.status(404).json({ message })
    }
}