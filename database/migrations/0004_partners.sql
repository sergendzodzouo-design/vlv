-- Module partenaires : organisations (concessionnaires, loueurs, particuliers gérés par VLV),
-- membres rattachés à une organisation et historique des décisions de certification.

-- Permet de vérifier qu'un arrondissement appartient bien à la ville indiquée.
alter table public.districts
  add constraint districts_id_city_key unique (id, city_id);

-- Fonction partagée par les tables en ajout seul (historiques et journal d'audit).
create or replace function public.forbid_modification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'La table % est en ajout seul : modification et suppression interdites.', tg_table_name
    using errcode = '42501';
end;
$$;

create table public.partner_organizations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('DEALER', 'RENTAL_COMPANY', 'BOTH', 'PRIVATE_SELLER')),
  trade_name text not null check (length(trim(trade_name)) > 0),
  legal_name text,
  contact_name text not null,
  phone text not null,
  whatsapp text,
  email text,
  city_id uuid not null references public.cities (id) on delete restrict,
  district_id uuid,
  address text,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'CERTIFIED', 'SUSPENDED', 'REFUSED', 'EXPIRED')),
  certified_at timestamptz,
  certification_expires_at timestamptz,
  -- Commission VLV sur la location, en points de base : 1000 = 10 %.
  rental_commission_bps integer not null default 1000
    check (rental_commission_bps between 0 and 10000),
  internal_note text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint partner_organizations_district_fk
    foreign key (district_id, city_id) references public.districts (id, city_id) on delete restrict,
  constraint partner_organizations_phone_e164 check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  constraint partner_organizations_whatsapp_e164
    check (whatsapp is null or whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
  constraint partner_organizations_certified_date
    check (status <> 'CERTIFIED' or certified_at is not null),
  constraint partner_organizations_certification_order
    check (
      certification_expires_at is null
      or certified_at is null
      or certification_expires_at > certified_at
    )
);

create index partner_organizations_status_idx
  on public.partner_organizations (status) where deleted_at is null;
create index partner_organizations_city_idx on public.partner_organizations (city_id);

create table public.partner_members (
  organization_id uuid not null references public.partner_organizations (id) on delete restrict,
  user_id uuid not null references public.users (id) on delete restrict,
  member_role text not null check (member_role in ('OWNER', 'MANAGER', 'STAFF')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index partner_members_user_id_idx on public.partner_members (user_id);

create table public.certification_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.partner_organizations (id) on delete restrict,
  action text not null check (
    action in ('CREATED', 'CERTIFIED', 'REFUSED', 'SUSPENDED', 'REINSTATED', 'EXPIRED', 'RENEWED', 'NOTE')
  ),
  from_status text,
  to_status text,
  reason text,
  actor_user_id uuid references public.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index certification_events_org_idx
  on public.certification_events (organization_id, created_at desc);

create trigger partner_organizations_set_updated_at
  before update on public.partner_organizations
  for each row execute function public.set_updated_at();

create trigger certification_events_append_only
  before update or delete on public.certification_events
  for each row execute function public.forbid_modification();

-- Sécurité en profondeur : tout accès passe par l'API VLV, jamais par l'accès direct.
alter table public.partner_organizations enable row level security;
alter table public.partner_members enable row level security;
alter table public.certification_events enable row level security;
