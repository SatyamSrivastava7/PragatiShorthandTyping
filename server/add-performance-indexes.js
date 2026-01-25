/**
 * Script to add performance indexes to reduce PostgreSQL compute costs
 * Run with: node server/add-performance-indexes.js
 */

const { Client } = require("pg");

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function addIndexes() {
  try {
    await client.connect();
    console.log("Connected to database...\n");

    // Results table indexes (frequently queried)
    console.log("Creating results table indexes...");
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_results_student_id_submitted_at 
        ON results(student_id, submitted_at DESC);
    `);
    console.log("✅ Created idx_results_student_id_submitted_at");

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_results_content_id 
        ON results(content_id);
    `);
    console.log("✅ Created idx_results_content_id");

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_results_student_id_content_type 
        ON results(student_id, content_type);
    `);
    console.log("✅ Created idx_results_student_id_content_type");

    // Content table indexes (frequently filtered)
    console.log("\nCreating content table indexes...");
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_content_folder_id_is_enabled 
        ON content(folder_id, is_enabled);
    `);
    console.log("✅ Created idx_content_folder_id_is_enabled");

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_content_type_is_enabled 
        ON content(type, is_enabled);
    `);
    console.log("✅ Created idx_content_type_is_enabled");

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_content_date_for 
        ON content(date_for);
    `);
    console.log("✅ Created idx_content_date_for");

    // Users table (for lookups)
    console.log("\nCreating users table indexes...");
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_batch 
        ON users(batch);
    `);
    console.log("✅ Created idx_users_batch");

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_student_id 
        ON users(student_id);
    `);
    console.log("✅ Created idx_users_student_id");

    // PDF table indexes
    console.log("\nCreating PDF table indexes...");
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pdf_resources_folder_id 
        ON pdf_resources(folder_id);
    `);
    console.log("✅ Created idx_pdf_resources_folder_id");

    // Test Folders indexes
    console.log("\nCreating test_folders table indexes...");
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_test_folders_language_type 
        ON test_folders(language, type);
    `);
    console.log("✅ Created idx_test_folders_language_type");

    await client.end();
    console.log("\n✅ All performance indexes created successfully!");
    console.log("\nExpected improvements:");
    console.log("  • 30-50% faster queries on frequently accessed data");
    console.log("  • Reduced CPU usage and query times");
    console.log("  • Lower PostgreSQL compute costs");
  } catch (error) {
    console.error("❌ Failed to add indexes:", error);
    process.exit(1);
  }
}

addIndexes();
