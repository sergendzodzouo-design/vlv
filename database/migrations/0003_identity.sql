-- Module identité : profils utilisateurs, rôles du personnel VLV et permissions.
-- Un client est un utilisateur sans rôle du personnel. Les partenaires sont rattachés
-- à une organisation dans une migration ultérieure.

create table public.users (
  id uuid primary key references auth.users (id) on delete restrict,
  full_name text not null,
  email text not null,
  phone text,
  phone_verified_at timestamptz,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'SUSPENDED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Numéro au format international E.164, par exemple +242060000000.
  constraint users_phone_e164 check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$')
);

create unique index users_email_lower_key on public.users (lower(email));

create table public.roles (
  code text primary key check (code ~ '^[A-Z_]+$'),
  label text not null,
  description text,
  created_at timestamptz not null default now()
);

create table public.permissions (
  code text primary key check (code ~ '^[a-z_]+\.[a-z_]+$'),
  label text not null,
  created_at timestamptz not null default now()
);

create table public.role_permissions (
  role_code text not null references public.roles (code) on delete cascade,
  permission_code text not null references public.permissions (code) on delete cascade,
  primary key (role_code, permission_code)
);

create table public.user_roles (
  user_id uuid not null references public.users (id) on delete restrict,
  role_code text not null references public.roles (code) on delete restrict,
  granted_by uuid references public.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role_code)
);

create index user_roles_role_code_idx on public.user_roles (role_code);

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- Sécurité en profondeur : tout accès passe par l'API VLV, jamais par l'accès direct.
alter table public.users enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;

insert into public.roles (code, label, description) values
  ('OPERATOR', 'Opérateur VLV', 'Traite les annonces, partenaires et demandes au quotidien.'),
  ('CERTIFICATION_MANAGER', 'Responsable certification', 'Valide, refuse ou suspend les partenaires.'),
  ('ADMIN', 'Administrateur', 'Administre les utilisateurs, les partenaires et les paramètres.'),
  ('SUPER_ADMIN', 'Super-administrateur', 'Gère aussi les habilitations. Accès exceptionnel, fortement audité.');

insert into public.permissions (code, label) values
  ('user.read', 'Consulter les utilisateurs'),
  ('user.suspend', 'Suspendre un utilisateur'),
  ('role.manage', 'Gérer les rôles et habilitations'),
  ('partner.read', 'Consulter les partenaires'),
  ('partner.create', 'Créer une organisation partenaire'),
  ('partner.update', 'Modifier une organisation partenaire'),
  ('partner.certify', 'Certifier ou refuser un partenaire'),
  ('partner.suspend', 'Suspendre un partenaire'),
  ('vehicle.read', 'Consulter les véhicules'),
  ('vehicle.update', 'Modifier les véhicules'),
  ('offer.read', 'Consulter les offres'),
  ('offer.moderate', 'Approuver ou rejeter une offre'),
  ('offer.suspend', 'Suspendre ou retirer une offre'),
  ('audit.read', 'Consulter le journal d''audit');

-- Permissions par défaut, ajustables : OPERATOR et CERTIFICATION_MANAGER sont volontairement restreints.
insert into public.role_permissions (role_code, permission_code) values
  ('OPERATOR', 'user.read'),
  ('OPERATOR', 'partner.read'),
  ('OPERATOR', 'partner.create'),
  ('OPERATOR', 'partner.update'),
  ('OPERATOR', 'vehicle.read'),
  ('OPERATOR', 'vehicle.update'),
  ('OPERATOR', 'offer.read'),
  ('OPERATOR', 'offer.moderate'),
  ('CERTIFICATION_MANAGER', 'partner.read'),
  ('CERTIFICATION_MANAGER', 'partner.certify'),
  ('CERTIFICATION_MANAGER', 'partner.suspend');

insert into public.role_permissions (role_code, permission_code)
select 'ADMIN', code from public.permissions where code <> 'role.manage';

insert into public.role_permissions (role_code, permission_code)
select 'SUPER_ADMIN', code from public.permissions;
