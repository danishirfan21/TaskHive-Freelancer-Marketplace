import "dotenv/config";
import pg from 'pg';
const { Client } = pg;

const connectionString = process.env.DATABASE_URL;

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log("Connected to DB");
  
  try {
    await client.query('ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS feedback TEXT;');
    console.log("Added feedback column to deliverables table");
  } catch (err) {
    console.error("Error altering table:", err);
  } finally {
    await client.end();
  }
}

run();
