-- =============================================================
-- Sistema Tato — schema inicial
-- CRM para gestão de shows e eventos musicais
-- =============================================================

-- Extensão para gen_random_uuid() (já disponível no Supabase, mas garantimos)
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------
-- Enum de status do show
-- ----------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'show_status') then
    create type public.show_status as enum (
      'criado',
      'em_fechamento',
      'fechado',
      'cancelado'
    );
  end if;
end$$;

-- ----------------------------------------------------------------
-- Função utilitária: atualiza updated_at automaticamente
-- ----------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------
-- Tabela: clients
-- ----------------------------------------------------------------
create table if not exists public.clients (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text,
  email      text,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------
-- Tabela: shows
-- ----------------------------------------------------------------
create table if not exists public.shows (
  id          uuid primary key default gen_random_uuid(),
  artist_name text not null,
  client_id   uuid references public.clients (id) on delete set null,
  event_date  date,
  location    text,
  status      public.show_status not null default 'criado',
  value_cents bigint,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists shows_status_idx on public.shows (status);
create index if not exists shows_event_date_idx on public.shows (event_date);
create index if not exists shows_client_id_idx on public.shows (client_id);

drop trigger if exists shows_set_updated_at on public.shows;
create trigger shows_set_updated_at
  before update on public.shows
  for each row
  execute function public.set_updated_at();

-- ----------------------------------------------------------------
-- Tabela: message_templates
-- ----------------------------------------------------------------
create table if not exists public.message_templates (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  content   text not null,
  variables jsonb not null default '{}'::jsonb
);

-- ----------------------------------------------------------------
-- Tabela: proposals
-- ----------------------------------------------------------------
create table if not exists public.proposals (
  id                  uuid primary key default gen_random_uuid(),
  show_id             uuid not null references public.shows (id) on delete cascade,
  template_used       text,
  sent_at             timestamptz,
  whatsapp_message_id text,
  status              text default 'pendente'
);

create index if not exists proposals_show_id_idx on public.proposals (show_id);

-- =============================================================
-- Row Level Security
-- Acesso restrito a usuários autenticados (app interno).
-- =============================================================
alter table public.clients           enable row level security;
alter table public.shows             enable row level security;
alter table public.message_templates enable row level security;
alter table public.proposals         enable row level security;

-- clients
drop policy if exists "clients: authenticated full access" on public.clients;
create policy "clients: authenticated full access"
  on public.clients for all
  to authenticated
  using (true)
  with check (true);

-- shows
drop policy if exists "shows: authenticated full access" on public.shows;
create policy "shows: authenticated full access"
  on public.shows for all
  to authenticated
  using (true)
  with check (true);

-- message_templates
drop policy if exists "message_templates: authenticated full access" on public.message_templates;
create policy "message_templates: authenticated full access"
  on public.message_templates for all
  to authenticated
  using (true)
  with check (true);

-- proposals
drop policy if exists "proposals: authenticated full access" on public.proposals;
create policy "proposals: authenticated full access"
  on public.proposals for all
  to authenticated
  using (true)
  with check (true);
