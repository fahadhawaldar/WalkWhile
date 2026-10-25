/**
 * Connects to a hosted database, applies any pending migrations and lists
 * the tables, without printing the connection string.
 *
 *   npx tsx scripts/checkDatabase.ts .env.neon
 *
 * The file holds one line: DATABASE_URL=postgres://...
 */
import { readFileSync } from 'node:fs';
import { createPostgresDatabase, runMigrations } from '../src/db/database.js';

const file = process.argv[2] ?? '.env.neon';
const line = readFileSync(file, 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .find((l) => l.startsWith('DATABASE_URL='));
const url = line?.slice('DATABASE_URL='.length).replace(/^["']|["']$/g, '');
if (!url) {
  console.error(`No DATABASE_URL= line in ${file}`);
  process.exit(1);
}

const { hostname } = new URL(url);
console.log(`Connecting to ${hostname} …`);
if (!/sslmode=require/.test(url)) {
  console.warn('Note: the URL has no sslmode=require; hosted Postgres usually needs it.');
}

const db = createPostgresDatabase(url);
try {
  const started = Date.now();
  const applied = await runMigrations(db);
  console.log(`Connected in ${Date.now() - started} ms.`);
  console.log(applied.length ? `Applied migrations: ${applied.join(', ')}` : 'Migrations already up to date.');
  const { rows } = await db.query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
  );
  console.log(`Tables: ${rows.map((r) => r.table_name).join(', ')}`);
} finally {
  await db.close();
}
