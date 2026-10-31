import pg from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL est absente. Copie .env.example en .env puis renseigne-la.");
  process.exit(1);
}

// Vérification locale de développement uniquement : le certificat n'est pas contrôlé ici.
// L'API de production devra vérifier le certificat (durcissement prévu avant la mise en ligne).
const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

try {
  await client.connect();

  const info = await client.query(
    "select current_database() as base, current_user as utilisateur, version() as version, now() as heure",
  );
  const row = info.rows[0];
  console.log("Connexion réussie.");
  console.log(`Base : ${row.base}`);
  console.log(`Utilisateur : ${row.utilisateur}`);
  console.log(`Version : ${row.version}`);
  console.log(`Heure serveur : ${row.heure.toISOString()}`);

  const extensions = await client.query(
    "select name, installed_version from pg_available_extensions where name in ('btree_gist', 'pg_trgm', 'pgcrypto') order by name",
  );
  console.log("Extensions nécessaires au projet :");
  for (const ext of extensions.rows) {
    console.log(`- ${ext.name} : disponible (${ext.installed_version ?? "non activée"})`);
  }
  if (extensions.rows.length < 3) {
    console.warn("Attention : au moins une extension attendue est absente.");
  }
} catch (error) {
  console.error("Échec de connexion :", error.code ?? "", error.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
