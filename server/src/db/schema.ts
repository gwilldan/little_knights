import { boolean } from "drizzle-orm/pg-core";
import { bigint, text, timestamp, pgTable } from "drizzle-orm/pg-core"

export const usersTable = pgTable("users", {
    id: text().notNull().primaryKey(),
    wallet: text().notNull().unique(),
    name: text().notNull(),
    joined: timestamp({ mode: "date", withTimezone: true }).defaultNow(),
    balance: bigint({ mode: "bigint" }).notNull()
});

export const gamesTable = pgTable("games", {
    id: text().notNull().unique().primaryKey(),
    user1: text().notNull().references(() => usersTable.id),
    user2: text().references(() => usersTable.id),
    is_multiplayer: boolean().notNull(),
    is_timed: boolean().notNull(),
    start_time: timestamp({ mode: "date", withTimezone: true }),
    stop_time: timestamp({ mode: "date", withTimezone: true })
})

export const transactionsTable = pgTable("transactions", {
    id: text().notNull().unique().primaryKey(),
    user_id: text().notNull().references(() => usersTable.id),
    type: text().notNull(),
    amount: bigint({ mode: "bigint" }).notNull(),
    recepient: text().references(() => usersTable.id)
})