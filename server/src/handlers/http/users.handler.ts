import { Request, Response } from "express";
import { usersTable } from "@/utils/config/schema";
import { db } from "@/utils/config/db.init";
import { eq } from "drizzle-orm";

export const getUser = async (req: Request, res: Response) => {
    try {
        const reqId = req.query.id as string
        const [user] = await db.select().from(usersTable).where(eq(usersTable.id, reqId)).limit(1)

        if (!user) {
            res.status(401).json({ message: "user not found" })
            return;
        }
        res.json(user)
    } catch (error) {
        console.log(error)
        const message = error instanceof Error ? error.message : error
        res.status(404).json({ message })
    }
}

export const createUser = async (req: Request, res: Response) => {
    try {
        const user = db.select().from(usersTable)
    } catch (error) {
        console.log(error)
        const message = error instanceof Error ? error.message : error
        res.status(404).json({ message })
    }
}