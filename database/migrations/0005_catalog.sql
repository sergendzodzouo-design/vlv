-- Module catalogue : catégories, marques, modèles, véhicules et photos.
-- Le véhicule physique est distinct de l'offre commerciale (voir la migration suivante).

create table public.vehicle_categories (
  code text primary key check (code ~ '^[A-Z_]+$'),
  label text not null,
  sort_order smallint not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.vehicle_categories (code, label, sort_order) values
  ('MOTO', 'Moto', 1),
  ('KAVAKI', 'Kavaki', 2),
  ('VOITURE', 'Voiture', 3),
  ('CAMION', 'Camion', 4),
  ('BUS', 'Bus', 5);

create table public.vehicle_brands (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index vehicle_brands_name_lower_key on public.vehicle_brands (lower(name));

create table public.vehicle_models (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.vehicle_brands (id) on delete restrict,
  category_code text not null references public.vehicle_categories (code) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, category_code, name),
  -- Clé utilisée par vehicles pour garantir la cohérence marque, modèle et catégorie.
  constraint vehicle_models_id_brand_category_key unique (id, brand_id, category_code)
);

create index vehicle_models_brand_idx on public.vehicle_models (brand_id);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.partner_organizations (id) on delete restrict,
  category_code text not null,
  brand_id uuid not null,
  model_id uuid not null,
  version text,
  year smallint check (year between 1950 and 2100),
  body_type text,
  transmission text check (transmission in ('MANUAL', 'AUTOMATIC')),
  fuel text check (fuel in ('PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'OTHER')),
  seats smallint check (seats between 1 and 100),
  payload_kg integer check (payload_kg >= 0),
  engine_cc integer check (engine_cc > 0),
  mileage_km integer check (mileage_km >= 0),
  condition text check (condition in ('NEW', 'USED')),
  description text,
  city_id uuid not null references public.cities (id) on delete restrict,
  district_id uuid,
  -- Attributs propres à une catégorie, validés côté serveur.
  specs jsonb not null default '{}'::jsonb check (jsonb_typeof(specs) = 'object'),
  -- Donnée privée : n'est jamais exposée publiquement.
  registration_plate text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'ARCHIVED')),
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- Le modèle doit appartenir à la marque et à la catégorie indiquées.
  constraint vehicles_model_consistency_fk
    foreign key (model_id, brand_id, category_code)
    references public.vehicle_models (id, brand_id, category_code) on delete restrict,
  constraint vehicles_district_fk
    foreign key (district_id, city_id) references public.districts (id, city_id) on delete restrict,
  -- Clé utilisée par offers pour garantir qu'une offre vise un véhicule de la même organisation.
  constraint vehicles_id_organization_key unique (id, organization_id)
);

create index vehicles_organization_idx on public.vehicles (organization_id);
create index vehicles_category_city_idx on public.vehicles (category_code, city_id);
create index vehicles_brand_idx on public.vehicles (brand_id);

create table public.vehicle_media (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  storage_path text not null unique,
  is_primary boolean not null default false,
  sort_order smallint not null default 0,
  width integer check (width > 0),
  height integer check (height > 0),
  created_at timestamptz not null default now()
);

create index vehicle_media_vehicle_idx on public.vehicle_media (vehicle_id, sort_order);
-- Une seule photo principale par véhicule.
create unique index vehicle_media_one_primary_idx on public.vehicle_media (vehicle_id) where is_primary;

create trigger vehicle_brands_set_updated_at
  before update on public.vehicle_brands
  for each row execute function public.set_updated_at();

create trigger vehicle_models_set_updated_at
  before update on public.vehicle_models
  for each row execute function public.set_updated_at();

create trigger vehicles_set_updated_at
  before update on public.vehicles
  for each row execute function public.set_updated_at();

-- Sécurité en profondeur : tout accès passe par l'API VLV, jamais par l'accès direct.
alter table public.vehicle_categories enable row level security;
alter table public.vehicle_brands enable row level security;
alter table public.vehicle_models enable row level security;
alter table public.vehicles enable row level security;
alter table public.vehicle_media enable row level security;
