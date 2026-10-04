import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = fileURLToPath(new URL('..', import.meta.url));

/** Fresh in-memory Postgres with the shim and the real schema.sql applied. */
export async function createDb(): Promise<PGlite> {
  const db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec(readFileSync(`${here}shim.sql`, 'utf8'));
  await db.exec(readFileSync(`${root}schema.sql`, 'utf8'));
  return db;
}
