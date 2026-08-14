-- =============================================================
-- Tarefas vinculadas a um show
-- Ex.: "confirmar rider com a casa", "cobrar 1ª parcela".
-- =============================================================

create table if not exists public.show_tasks (
  id         uuid primary key default gen_random_uuid(),
  show_id    uuid not null references public.shows (id) on delete cascade,
  title      text not null,
  due_date   date,
  done       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists show_tasks_show_id_idx
  on public.show_tasks (show_id);

-- Sustenta o resumo do Dashboard, que busca só as pendentes por vencimento.
create index if not exists show_tasks_pendentes_idx
  on public.show_tasks (due_date)
  where done = false;

-- ----------------------------------------------------------------
-- RLS — mesmo padrão das demais tabelas: app interno, só autenticados.
-- ----------------------------------------------------------------
alter table public.show_tasks enable row level security;

drop policy if exists "show_tasks: authenticated full access" on public.show_tasks;
create policy "show_tasks: authenticated full access"
  on public.show_tasks for all
  to authenticated
  using (true)
  with check (true);
