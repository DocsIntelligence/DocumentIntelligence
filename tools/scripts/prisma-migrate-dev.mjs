#!/usr/bin/env node
/**
 * Drift-safe replacement for `prisma migrate dev` (docs/09).
 *
 * Prisma can't represent three SearchIndex objects in schema.prisma — the
 * generated `tsv` column, the GIN index on it, and the pgvector HNSW index — so
 * every `migrate dev` writes spurious statements that try to DROP them (and the
 * `tsv DROP DEFAULT` even fails on a generated column → P3018). This wrapper:
 *
 *   1. `prisma migrate dev --create-only`  (generate, don't apply)
 *   2. strip the known spurious SearchIndex statements from the new migration
 *   3. if nothing real is left → delete the migration (it was pure drift)
 *      else → `prisma migrate deploy` (apply the cleaned migration)
 *   4. `prisma generate`
 *
 * Result: `pnpm prisma:migrate:dev [--name x]` behaves like `migrate dev` but
 * never drops the search indexes and never needs hand-editing. All extra args
 * (e.g. `--name search`) are forwarded to step 1.
 */
import { execSync } from 'node:child_process';
import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = 'tools/prisma/migrations';
const forwardedArgs = process.argv.slice(2).join(' ');

/** Lines that are spurious SearchIndex drift and must never be applied. */
const SPURIOUS = [
  // DROP of the GIN(tsv) / trgm(title) / HNSW(embedding) indexes.
  /^\s*DROP INDEX\s+.*"SearchIndex_(tsv_idx|title_trgm_idx|embedding_hnsw_idx)".*;?\s*$/i,
  // The generated-column "default" Prisma wrongly tries to drop.
  /^\s*ALTER TABLE\s+"SearchIndex"\s+ALTER COLUMN\s+"tsv"\s+DROP\s+(DEFAULT|EXPRESSION).*;?\s*$/i,
  /^\s*ALTER COLUMN\s+"tsv"\s+DROP\s+(DEFAULT|EXPRESSION).*;?\s*$/i,
];

function isMigrationDir(name) {
  return /^\d{14}_/.test(name);
}

function run(cmd) {
  execSync(cmd, { stdio: 'inherit' });
}

/** Remove spurious statements (and any `-- Comment` line that directly precedes
 *  one) from a migration's SQL. */
function pruneDrift(sql) {
  const out = [];
  for (const line of sql.split('\n')) {
    if (SPURIOUS.some((re) => re.test(line))) {
      // Drop a comment header we just emitted for this statement.
      if (out.length && /^\s*--/.test(out[out.length - 1])) out.pop();
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}

/** True when only comments / whitespace remain (no real SQL). */
function isEffectivelyEmpty(sql) {
  return sql
    .split('\n')
    .every((l) => l.trim() === '' || l.trim().startsWith('--'));
}

// 1. snapshot, then generate the migration without applying it.
const before = new Set(readdirSync(MIGRATIONS_DIR).filter(isMigrationDir));
run(`pnpm exec prisma migrate dev --create-only ${forwardedArgs}`.trim());

// 2. find the newly created migration.
const created = readdirSync(MIGRATIONS_DIR)
  .filter(isMigrationDir)
  .find((d) => !before.has(d));

if (!created) {
  console.log('\n✔ No schema changes — nothing to migrate.');
  run('pnpm exec prisma generate');
  process.exit(0);
}

const dir = join(MIGRATIONS_DIR, created);
const sqlPath = join(dir, 'migration.sql');
const original = existsSync(sqlPath) ? readFileSync(sqlPath, 'utf8') : '';
const pruned = pruneDrift(original);

if (pruned !== original) {
  console.log(`\n✂  Stripped spurious SearchIndex drift from ${created}.`);
}

// 3. pure-drift migration → discard it entirely (avoids an empty migration).
if (isEffectivelyEmpty(pruned)) {
  rmSync(dir, { recursive: true, force: true });
  console.log(
    `\n✔ ${created} was only SearchIndex drift — removed, nothing to apply.`,
  );
  run('pnpm exec prisma generate');
  process.exit(0);
}

// 4. apply the cleaned migration + regenerate the client.
writeFileSync(sqlPath, pruned);
console.log(`\n▶ Applying cleaned migration ${created} …`);
run('pnpm exec prisma migrate deploy');
run('pnpm exec prisma generate');
console.log('\n✔ Done.');
