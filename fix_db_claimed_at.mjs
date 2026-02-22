import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://postgres.lwrejrjcclejrbgxyvug:GaQQ5gyFB3YcRNBx@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres";

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log("Connected to DB");
  
  try {
    await client.query('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;');
    console.log("Added claimed_at column to tasks table");
  } catch (err) {
    console.error("Error altering table:", err);
  } finally {
    await client.end();
  }
}

run();
