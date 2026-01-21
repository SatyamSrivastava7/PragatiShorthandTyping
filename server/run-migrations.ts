import fs from "fs";
import path from "path";
import { db } from "./db";
import { sql } from "drizzle-orm";

/**
 * Simple migration runner for SQL files
 * Reads and executes migration files in order
 */
async function runMigrations() {
  try {
    console.log("Starting migrations...");

    const migrationsDir = path.join(process.cwd(), "migrations");
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    console.log(`Found ${files.length} migration files`);

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const content = fs.readFileSync(filePath, "utf-8");

      console.log(`\n▶ Running migration: ${file}`);
      
      try {
        await db.execute(sql.raw(content));
        console.log(`✓ Successfully completed: ${file}`);
      } catch (error) {
        // Check if the error is about column already existing (this is fine for idempotent migrations)
        if (
          error instanceof Error &&
          error.message.includes("already exists")
        ) {
          console.log(`⚠ Column already exists: ${file} (skipping)`);
        } else {
          throw error;
        }
      }
    }

    console.log("\n✓ All migrations completed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

runMigrations();
