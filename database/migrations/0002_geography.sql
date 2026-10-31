-- Villes et arrondissements couverts au lancement.
-- Les arrondissements sont à vérifier par VLV avant la mise en production.

create table public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.districts (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities (id) on delete restrict,
  name text not null,
  sort_order smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city_id, name),
  unique (city_id, sort_order)
);

create trigger cities_set_updated_at
  before update on public.cities
  for each row execute function public.set_updated_at();

create trigger districts_set_updated_at
  before update on public.districts
  for each row execute function public.set_updated_at();

-- Sécurité en profondeur : tout accès passe par l'API VLV, jamais par l'accès direct.
alter table public.cities enable row level security;
alter table public.districts enable row level security;

with brazzaville as (
  insert into public.cities (name, slug) values ('Brazzaville', 'brazzaville') returning id
)
insert into public.districts (city_id, name, sort_order)
select brazzaville.id, d.name, d.sort_order
from brazzaville
cross join (
  values
    ('Makélékélé', 1),
    ('Bacongo', 2),
    ('Poto-Poto', 3),
    ('Moungali', 4),
    ('Ouenzé', 5),
    ('Talangaï', 6),
    ('Mfilou', 7),
    ('Madibou', 8),
    ('Djiri', 9)
) as d (name, sort_order);

with pointe_noire as (
  insert into public.cities (name, slug) values ('Pointe-Noire', 'pointe-noire') returning id
)
insert into public.districts (city_id, name, sort_order)
select pointe_noire.id, d.name, d.sort_order
from pointe_noire
cross join (
  values
    ('Lumumba', 1),
    ('Mvou-Mvou', 2),
    ('Tié-Tié', 3),
    ('Loandjili', 4),
    ('Mongo-Mpoukou', 5),
    ('Ngoyo', 6)
) as d (name, sort_order);
