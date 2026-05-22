import "dotenv/config"
import { defineConfig } from "drizzle-kit"

export default defineConfig({
    dialect: "postgresql",
    schema: "./src/utils/config/schema.ts",
    out: "./drizzle",
    dbCredentials: {
        url: process.env.DATABASE_URL!
    }
})