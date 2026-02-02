/**
 * Script to add type column to test_folders table
 * Run with: node server/add-type-to-folders.js
 */

import pkg from "pg";
const { Client } = pkg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  try {
    await client.connect();
    console.log("Connected to database...");

    // Add type column to test_folders table
    console.log("Adding type column to test_folders table...");
    
    await client.query(`
      ALTER TABLE test_folders 
      ADD COLUMN IF NOT EXISTS type varchar(20) NOT NULL DEFAULT 'typing';
    `);

    console.log("✅ Successfully added type column to test_folders");
    
    // Create index for faster filtering
    console.log("Creating index on type column...");
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_test_folders_type 
      ON test_folders(type);
    `);

    console.log("✅ Successfully created index on type column");

    // Update folder types based on content
    console.log("\nUpdating folder types based on their content...");
    
    const result = await client.query(`
      UPDATE test_folders tf
      SET type = (
        SELECT DISTINCT c.type
        FROM content c
        WHERE c.folder_id = tf.id
        LIMIT 1
      )
      WHERE EXISTS (
        SELECT 1 FROM content c WHERE c.folder_id = tf.id
      );
    `);

    console.log(`✅ Updated ${result.rowCount} folders with correct types`);

    await client.end();
    console.log("\n✓ Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  }
}

runMigration();
