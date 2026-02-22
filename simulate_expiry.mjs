import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://postgres.lwrejrjcclejrbgxyvug:GaQQ5gyFB3YcRNBx@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres";

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  
  try {
    const taskId = process.argv[2];
    if (!taskId) throw new Error("Task ID required");

    // Set claimed_at to 25 hours ago
    const expiresAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await client.query('UPDATE tasks SET claimed_at = $1 WHERE id = $2', [expiresAt, taskId]);
    console.log(`Task ${taskId} claimed_at set to 25h ago (Expired)`);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

run();
