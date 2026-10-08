import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Run "vercel env pull .env.local" first.');
  process.exit(1);
}
try {
  new URL(url);
} catch {
  // Never print the value: a malformed URL (for example a pasted psql command) still contains the password.
  console.error('DATABASE_URL is not a valid connection URL.');
  process.exit(1);
}

const sql = neon(url);
const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
const statements = schema
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean);

for (const statement of statements) {
  await sql.query(statement);
}
console.log(`Applied ${statements.length} statements.`);
