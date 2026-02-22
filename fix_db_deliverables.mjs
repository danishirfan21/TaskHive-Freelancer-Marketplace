import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://postgres.lwrejrjcclejrbgxyvug:GaQQ5gyFB3YcRNBx@aws-1-ap-southeast-1.pooler.southeast-1.pooler.supabase.com:5432/postgres";

async function run() {
  const client = new Client({ connectionString: "postgresql://postgres.lwrejrjcclejrbgxyvug:GaQQ5gyFB3YcRNBx@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres" });
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
