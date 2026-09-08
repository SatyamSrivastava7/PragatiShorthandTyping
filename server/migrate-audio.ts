/**
 * Legacy compatibility check for the former content-audio migration.
 *
 * Audio columns were removed from the current content model. This script is
 * intentionally read-only so running it cannot rewrite or discard legacy
 * media_url values that are still present in development data.
 *
 * Usage: npx tsx server/migrate-audio.ts
 */

import { db } from "./db";
import { sql } from "drizzle-orm";

async function migrateAudio() {
  console.log("Checking legacy content audio data...");

  try {
    const rows = await db.execute(sql`
      SELECT id, title
      FROM content
      WHERE media_url IS NOT NULL
    `);
    console.log(`Found ${rows.rows.length} legacy content audio values.`);
    console.log("No changes made; the current app no longer uses content audio columns.");
  } catch (error) {
    console.error("Legacy audio check failed:", error);
    process.exit(1);
  }
}

migrateAudio().then(() => {
  console.log("Legacy audio check completed.");
  process.exit(0);
});
