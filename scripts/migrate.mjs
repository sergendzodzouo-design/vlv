import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "database",
  "migrations",
);
const FILE_PATTERN = /^\d{4}_[a-z0-9_]+\.sql$/;
const LOCK_KEY = 727401;

const command = process.argv[2] ?? "up";
if (!["up", "status"].includes(command)) {
  console.error('Commande inconnue. Utilise "up" ou "status".');
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL est absente. Copie .env.example en .env puis renseigne-la.");
  process.exit(1);
}

// Développement uniquement : le certificat n'est pas contrôlé ici.
// L'exécution en production devra vérifier le certificat (durcissement prévu avant la mise en ligne).
const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

const checksum = (sql) => createHash("sha256").update(sql.replace(/\r\n/g, "\n")).digest("hex");

async function loadMigrations() {
  const names = (await readdir(MIGRATIONS_DIR)).filter((name) => FILE_PATTERN.test(name)).sort();
  return Promise.all(
    names.map(async (name) => {
      const sql = await readFile(join(MIGRATIONS_DIR, name), "utf8");
      return { name, sql, checksum: checksum(sql) };
    }),
  );
}

let locked = false;

try {
  await client.connect();
  await client.query("select pg_advisory_lock($1)", [LOCK_KEY]);
  locked = true;

  await client.query(`
    create table if not exists public.schema_migrations (
      name text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    )
  `);
  await client.query("alter table public.schema_migrations enable row level security");

  const { rows } = await client.query(
    "select name, checksum from public.schema_migrations order by name",
  );
  const applied = new Map(rows.map((row) => [row.name, row.checksum]));
  const migrations = await loadMigrations();
  const known = new Set(migrations.map((migration) => migration.name));

  for (const name of applied.keys()) {
    if (!known.has(name)) {
      console.warn(`Attention : ${name} est appliquée en base mais son fichier est introuvable.`);
    }
  }

  for (const migration of migrations) {
    const previous = applied.get(migration.name);
    if (previous !== undefined && previous !== migration.checksum) {
      throw new Error(
        `${migration.name} a été modifiée après son application. Ne modifie jamais une migration appliquée : crée-en une nouvelle.`,
      );
    }
  }

  const pending = migrations.filter((migration) => !applied.has(migration.name));

  if (command === "status") {
    console.log(`Appliquées : ${applied.size}`);
    for (const name of applied.keys()) console.log(`  [x] ${name}`);
    console.log(`En attente : ${pending.length}`);
    for (const migration of pending) console.log(`  [ ] ${migration.name}`);
  } else if (pending.length === 0) {
    console.log("Aucune migration en attente.");
  } else {
    for (const migration of pending) {
      console.log(`Application de ${migration.name}...`);
      await client.query("begin");
      try {
        await client.query(migration.sql);
        await client.query(
          "insert into public.schema_migrations (name, checksum) values ($1, $2)",
          [migration.name, migration.checksum],
        );
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw new Error(`Échec de ${migration.name} : ${error.message}`);
      }
      console.log(`  OK ${migration.name}`);
    }
    console.log(`${pending.length} migration(s) appliquée(s).`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (locked) {
    await client.query("select pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => {});
  }
  await client.end().catch(() => {});
}
