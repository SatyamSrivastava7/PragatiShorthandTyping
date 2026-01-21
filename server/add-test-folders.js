/**
 * Script to add test_folders table and folderId column to content table
 * Run with: node server/add-test-folders.js
 */

const { Client } = require("pg");

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  try {
    await client.connect();
    console.log("Connected to database...");

    // Create test_folders table
    console.log("Creating test_folders table...");
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS test_folders (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        language VARCHAR(10) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("✅ Successfully created test_folders table");

    // Add folderId column to content table
    console.log("Adding folderId column to content table...");
    
    await client.query(`
      ALTER TABLE content 
      ADD COLUMN IF NOT EXISTS folder_id INTEGER REFERENCES test_folders(id) ON DELETE SET NULL;
    `);

    console.log("✅ Successfully added folder_id column to content table");

    // Create index on language for faster queries
    console.log("Creating index on test_folders.language for performance...");
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_test_folders_language ON test_folders(language);
    `);

    console.log("✅ Successfully created index on test_folders.language");

    await client.end();
    console.log("\n✅ Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

runMigration();
