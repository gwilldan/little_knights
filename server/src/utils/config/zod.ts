import z from "zod"
import { usersTable } from "./schema"

const User_insert = usersTable.$inferInsert

const User = {
    ...User_insert,
}