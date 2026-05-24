import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

console.log("Initializing database connection...", process.env.DATABASE_URL!)

export const pg = new Pool({ connectionString: process.env.DATABASE_URL! })
export const db = drizzle({ client: pg })