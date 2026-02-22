import pg from 'pg';
const { Client } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

async function run() {
  const client = new Client({ connectionString });
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
