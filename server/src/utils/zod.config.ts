import z from "zod"

export const userInsert = z.object({
    id: z.string().nonempty().trim(),
    name: z.string().nonempty().trim(),
    balance: z.bigint().nonoptional(),
    joined: z.date().optional()
})

export const transactionInsert = z.object({
    id: z.string().nonempty().trim(),
    user_id: z.string().nonempty().trim(),
    type: z.string().nonempty().trim(),
    amount: z.bigint().nonoptional(),
    recepient: z.string().trim().optional()
})

export const gameInsert = z.object({
    id: z.string().nonempty().trim(),
    user1: z.string().nonempty().trim(),
    is_multiplayer: z.boolean().nonoptional(),
    is_timed: z.boolean().nonoptional(),
    user2: z.string().trim().optional(),
    start_time: z.date().optional(),
    stop_time: z.date().optional()
})

export type UserInsert = z.infer<typeof userInsert>
export type TransactionInsert = z.infer<typeof transactionInsert>
export type GameInsert = z.infer<typeof gameInsert>