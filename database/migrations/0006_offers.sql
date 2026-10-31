-- Module offres : propositions commerciales de vente ou de location, conditions de location,
-- historique des changements de statut et vue publique.

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null,
  organization_id uuid not null,
  type text not null check (type in ('RENT', 'SALE')),
  status text not null default 'DRAFT'
    check (
      status in ('DRAFT', 'PENDING_MODERATION', 'PUBLISHED', 'SUSPENDED', 'EXPIRED', 'WITHDRAWN', 'SOLD')
    ),
  -- Vente : prix de vente. Location : prix par unité tarifaire (voir offer_rental_terms).
  price_xaf bigint not null check (price_xaf > 0),
  currency text not null default 'XAF' check (currency = 'XAF'),
  price_negotiable boolean not null default false,
  description text,
  conditions text,
  valid_from timestamptz,
  valid_until timestamptz,
  published_at timestamptz,
  moderation_note text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Le véhicule doit appartenir à la même organisation que l'offre.
  constraint offers_vehicle_owner_fk
    foreign key (vehicle_id, organization_id)
    references public.vehicles (id, organization_id) on delete restrict,
  constraint offers_validity_order
    check (valid_from is null or valid_until is null or valid_until > valid_from),
  constraint offers_published_date check (status <> 'PUBLISHED' or published_at is not null),
  constraint offers_id_type_key unique (id, type)
);

-- Un véhicule peut avoir une offre de location et une offre de vente, mais une seule de chaque type active.
create unique index offers_one_active_per_vehicle_and_type_idx
  on public.offers (vehicle_id, type)
  where status in ('DRAFT', 'PENDING_MODERATION', 'PUBLISHED', 'SUSPENDED');

create index offers_organization_idx on public.offers (organization_id);
create index offers_public_idx on public.offers (type, published_at desc) where status = 'PUBLISHED';

-- Les conditions de location ne peuvent exister que pour une offre de type RENT.
create table public.offer_rental_terms (
  offer_id uuid primary key,
  offer_type text not null default 'RENT' check (offer_type = 'RENT'),
  price_unit text not null check (price_unit in ('HOUR', 'DAY', 'WEEK', 'MONTH', 'FLAT')),
  driver_option text not null default 'WITHOUT' check (driver_option in ('WITHOUT', 'WITH', 'BOTH')),
  driver_extra_xaf bigint check (driver_extra_xaf >= 0),
  km_included integer check (km_included >= 0),
  fuel_policy text,
  -- La caution est une simple mention : elle est collectée hors plateforme en V1.
  deposit_note text,
  min_duration_hours integer check (min_duration_hours > 0),
  max_duration_hours integer check (max_duration_hours > 0),
  -- AUTO : confirmation sans action du partenaire. MANUAL : le partenaire confirme.
  confirmation_mode text not null default 'AUTO' check (confirmation_mode in ('AUTO', 'MANUAL')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offer_rental_terms_offer_fk
    foreign key (offer_id, offer_type) references public.offers (id, type) on delete cascade,
  constraint offer_rental_terms_duration_order
    check (
      max_duration_hours is null
      or min_duration_hours is null
      or max_duration_hours >= min_duration_hours
    )
);

create table public.offer_status_history (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers (id) on delete restrict,
  from_status text,
  to_status text not null,
  reason text,
  actor_user_id uuid references public.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index offer_status_history_offer_idx on public.offer_status_history (offer_id, created_at);

-- Une organisation ne publie que les types d'offre que son type autorise.
create or replace function public.enforce_offer_org_type()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  org_type text;
begin
  select type into org_type from public.partner_organizations where id = new.organization_id;

  if new.type = 'RENT' and org_type not in ('RENTAL_COMPANY', 'BOTH') then
    raise exception 'Cette organisation ne peut pas publier d''offre de location.'
      using errcode = '23514';
  end if;

  if new.type = 'SALE' and org_type not in ('DEALER', 'BOTH', 'PRIVATE_SELLER') then
    raise exception 'Cette organisation ne peut pas publier d''offre de vente.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger offers_enforce_org_type
  before insert or update of type, organization_id on public.offers
  for each row execute function public.enforce_offer_org_type();

create trigger offers_set_updated_at
  before update on public.offers
  for each row execute function public.set_updated_at();

create trigger offer_rental_terms_set_updated_at
  before update on public.offer_rental_terms
  for each row execute function public.set_updated_at();

create trigger offer_status_history_append_only
  before update or delete on public.offer_status_history
  for each row execute function public.forbid_modification();

-- Sécurité en profondeur : tout accès passe par l'API VLV, jamais par l'accès direct.
alter table public.offers enable row level security;
alter table public.offer_rental_terms enable row level security;
alter table public.offer_status_history enable row level security;

-- Vue publique : seul endroit où la visibilité publique d'une offre est définie.
-- Elle n'expose ni la plaque d'immatriculation, ni les notes internes, ni les coordonnées.
create view public.public_offers
with (security_invoker = true)
as
select
  o.id as offer_id,
  o.type,
  o.price_xaf,
  o.currency,
  o.price_negotiable,
  o.description as offer_description,
  o.conditions,
  o.valid_from,
  o.valid_until,
  o.published_at,
  v.id as vehicle_id,
  v.category_code,
  b.name as brand_name,
  m.name as model_name,
  v.version,
  v.year,
  v.body_type,
  v.transmission,
  v.fuel,
  v.seats,
  v.payload_kg,
  v.engine_cc,
  v.mileage_km,
  v.condition,
  v.description as vehicle_description,
  v.specs,
  c.id as city_id,
  c.name as city_name,
  d.id as district_id,
  d.name as district_name,
  org.id as organization_id,
  org.trade_name as organization_name,
  t.price_unit,
  t.driver_option,
  t.driver_extra_xaf,
  t.km_included,
  t.fuel_policy,
  t.deposit_note,
  t.min_duration_hours,
  t.max_duration_hours,
  t.confirmation_mode,
  (
    select media.storage_path
    from public.vehicle_media media
    where media.vehicle_id = v.id and media.is_primary
    limit 1
  ) as primary_image_path
from public.offers o
join public.vehicles v on v.id = o.vehicle_id
join public.vehicle_brands b on b.id = v.brand_id
join public.vehicle_models m on m.id = v.model_id
join public.cities c on c.id = v.city_id
left join public.districts d on d.id = v.district_id
join public.partner_organizations org on org.id = o.organization_id
left join public.offer_rental_terms t on t.offer_id = o.id
where o.status = 'PUBLISHED'
  and (o.valid_from is null or o.valid_from <= now())
  and (o.valid_until is null or o.valid_until > now())
  and org.status = 'CERTIFIED'
  and org.deleted_at is null
  and v.status = 'ACTIVE'
  and v.deleted_at is null;
