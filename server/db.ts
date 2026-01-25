import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

if (!global.pgPool) {
  global.pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 10000,
  });
}

export const pool = global.pgPool;

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

export const db = drizzle(pool, { schema });

// Warmup function to keep database connection alive
export async function warmupDatabase() {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('Database connection warmed up');
  } catch (error) {
    console.error('Database warmup failed:', error);
  }
}

// Initial warmup on startup
warmupDatabase();

// Keep connection warm every 4 minutes (Neon has 5 minute idle timeout)
setInterval(warmupDatabase, 4 * 60 * 1000);
