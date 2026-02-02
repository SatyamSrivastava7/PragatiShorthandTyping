/**
 * Script to remove audio-related columns from the database
 * Removes: mediaUrl, audio80wpm, audio100wpm
 * Run with: node server/run-migration.js
 */

const { Client } = require("pg");

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  try {
    await client.connect();
    console.log("Connected to database...");

    // Drop audio columns from content table
    console.log("Removing audio-related columns from content table...");
    
    await client.query(`
      ALTER TABLE content 
      DROP COLUMN IF EXISTS media_url,
      DROP COLUMN IF EXISTS audio_80wpm,
      DROP COLUMN IF EXISTS audio_100wpm;
    `);

    console.log("✅ Successfully removed audio columns:");
    console.log("   - media_url");
    console.log("   - audio_80wpm");
    console.log("   - audio_100wpm");

    // Add new video link columns for shorthand tests
    console.log("\nAdding video link columns for shorthand tests...");
    
    await client.query(`
      ALTER TABLE content 
      ADD COLUMN IF NOT EXISTS video_60wpm TEXT,
      ADD COLUMN IF NOT EXISTS video_80wpm TEXT,
      ADD COLUMN IF NOT EXISTS video_100wpm TEXT,
      ADD COLUMN IF NOT EXISTS video_120wpm TEXT;
    `);

    console.log("✅ Successfully added video link columns:");
    console.log("   - video_60wpm");
    console.log("   - video_80wpm");
    console.log("   - video_100wpm");
    console.log("   - video_120wpm");

    await client.end();
    console.log("\n✅ Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

runMigration();
