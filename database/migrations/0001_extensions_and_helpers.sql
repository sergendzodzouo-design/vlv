-- Extensions nécessaires au projet.
-- btree_gist : interdire deux réservations qui se chevauchent (module réservation).
-- pg_trgm : recherche par texte tolérante aux fautes de frappe.
-- pgcrypto : déjà présente sur Supabase, déclarée par sécurité.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- Met à jour automatiquement la colonne updated_at lors d'une modification.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
