import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL est absente. Copie .env.example en .env puis renseigne-la.");
  process.exit(1);
}

// Développement uniquement : le certificat n'est pas contrôlé ici.
const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

const results = [];

const one = async (sql, params = []) => (await client.query(sql, params)).rows[0];

async function expectFailure(label, sql, params = []) {
  await client.query("savepoint verification");
  try {
    await client.query(sql, params);
    results.push({ label, ok: false, detail: "aucune erreur levée alors qu'elle était attendue" });
  } catch (error) {
    results.push({ label, ok: true, detail: error.message });
  } finally {
    await client.query("rollback to savepoint verification");
  }
}

async function expectPublicCount(label, offerId, expected) {
  const { count } = await one(
    "select count(*)::int as count from public.public_offers where offer_id = $1",
    [offerId],
  );
  results.push({
    label,
    ok: count === expected,
    detail: `${count} résultat(s), ${expected} attendu(s)`,
  });
}

try {
  await client.connect();
  await client.query("begin");

  const city = await one("select id from public.cities where slug = 'brazzaville'");

  const insertOrg = (type, name, phone) =>
    one(
      `insert into public.partner_organizations (type, trade_name, contact_name, phone, city_id)
       values ($1, $2, 'Contact test', $3, $4) returning id`,
      [type, name, phone, city.id],
    );
  const dealer = await insertOrg("DEALER", "Concession test", "+242060000001");
  const renter = await insertOrg("RENTAL_COMPANY", "Loueur test", "+242060000002");

  const brand = await one(
    "insert into public.vehicle_brands (name) values ('Marque test') returning id",
  );
  const otherBrand = await one(
    "insert into public.vehicle_brands (name) values ('Autre marque test') returning id",
  );
  const model = await one(
    `insert into public.vehicle_models (brand_id, category_code, name)
     values ($1, 'VOITURE', 'Modèle test') returning id`,
    [brand.id],
  );

  const insertVehicleSql = `insert into public.vehicles
    (organization_id, category_code, brand_id, model_id, city_id)
    values ($1, 'VOITURE', $2, $3, $4) returning id`;
  const dealerVehicle = await one(insertVehicleSql, [dealer.id, brand.id, model.id, city.id]);
  const renterVehicle = await one(insertVehicleSql, [renter.id, brand.id, model.id, city.id]);

  const insertOfferSql = `insert into public.offers (vehicle_id, organization_id, type, price_xaf)
    values ($1, $2, $3, $4) returning id`;

  await expectFailure(
    "Un concessionnaire ne peut pas publier d'offre de location",
    insertOfferSql,
    [dealerVehicle.id, dealer.id, "RENT", 100000],
  );
  await expectFailure(
    "Une offre ne peut pas viser le véhicule d'un autre partenaire",
    insertOfferSql,
    [renterVehicle.id, dealer.id, "SALE", 1000],
  );
  await expectFailure("Le modèle d'un véhicule doit correspondre à sa marque", insertVehicleSql, [
    dealer.id,
    otherBrand.id,
    model.id,
    city.id,
  ]);
  await expectFailure("Un prix à zéro est refusé", insertOfferSql, [
    dealerVehicle.id,
    dealer.id,
    "SALE",
    0,
  ]);

  const saleOffer = await one(insertOfferSql, [dealerVehicle.id, dealer.id, "SALE", 28000000]);

  await expectFailure("Une seule offre active du même type par véhicule", insertOfferSql, [
    dealerVehicle.id,
    dealer.id,
    "SALE",
    29000000,
  ]);
  await expectFailure(
    "Les conditions de location sont réservées aux offres de location",
    "insert into public.offer_rental_terms (offer_id, price_unit) values ($1, 'DAY')",
    [saleOffer.id],
  );
  await expectFailure(
    "Un numéro de téléphone invalide est refusé",
    `insert into public.partner_organizations (type, trade_name, contact_name, phone, city_id)
     values ('DEALER', 'Téléphone invalide', 'Contact', '0600', $1)`,
    [city.id],
  );

  await client.query(
    "update public.offers set status = 'PUBLISHED', published_at = now() where id = $1",
    [saleOffer.id],
  );
  await expectPublicCount("Offre publiée d'un partenaire en attente : invisible", saleOffer.id, 0);

  await client.query(
    "update public.partner_organizations set status = 'CERTIFIED', certified_at = now() where id = $1",
    [dealer.id],
  );
  await expectPublicCount("Offre publiée d'un partenaire certifié : visible", saleOffer.id, 1);

  await client.query("update public.partner_organizations set status = 'SUSPENDED' where id = $1", [
    dealer.id,
  ]);
  await expectPublicCount("Partenaire suspendu : l'offre disparaît", saleOffer.id, 0);

  const audit = await one(
    "insert into public.audit_logs (action, entity_type) values ('test.verify', 'test') returning id",
  );
  await expectFailure(
    "Le journal d'audit refuse la modification",
    "update public.audit_logs set action = 'modifie' where id = $1",
    [audit.id],
  );
  await expectFailure(
    "Le journal d'audit refuse la suppression",
    "delete from public.audit_logs where id = $1",
    [audit.id],
  );

  for (const result of results) {
    console.log(`${result.ok ? "[OK]" : "[ÉCHEC]"} ${result.label}`);
    console.log(`     ${result.detail}`);
  }
  const passed = results.filter((result) => result.ok).length;
  console.log(`\n${passed}/${results.length} vérifications réussies.`);
  if (passed !== results.length) process.exitCode = 1;
} catch (error) {
  console.error("Erreur pendant la vérification :", error.message);
  process.exitCode = 1;
} finally {
  await client.query("rollback").catch(() => {});
  await client.end().catch(() => {});
}
