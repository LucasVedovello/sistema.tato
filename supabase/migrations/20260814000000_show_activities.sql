-- =============================================================
-- Timeline de atividades do show
--
-- Registra o que aconteceu com cada show: criação, mudanças de status,
-- mensagens enviadas e notas escritas à mão.
-- =============================================================

create table if not exists public.show_activities (
  id           uuid primary key default gen_random_uuid(),
  show_id      uuid not null references public.shows (id) on delete cascade,
  -- 'created' | 'status' | 'note' | 'message'
  kind         text not null,
  -- Texto livre: corpo da nota ou descrição da mensagem enviada.
  content      text,
  -- Preenchidos apenas em kind='status'/'created'.
  from_status  public.show_status,
  to_status    public.show_status,
  author_email text,
  created_at   timestamptz not null default now(),
  constraint show_activities_kind_check
    check (kind in ('created', 'status', 'note', 'message'))
);

create index if not exists show_activities_show_id_idx
  on public.show_activities (show_id, created_at desc);

-- ----------------------------------------------------------------
-- Registro automático de criação e de mudança de status.
--
-- Fica no banco, e não no app, porque o status muda por vários caminhos
-- (formulário do show e arrasto no Kanban). Um gatilho garante que a timeline
-- não fique com buracos quando surgir um caminho novo.
-- ----------------------------------------------------------------
create or replace function public.log_show_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.show_activities (show_id, kind, to_status, author_email)
    values (new.id, 'created', new.status, nullif(auth.jwt() ->> 'email', ''));
  elsif TG_OP = 'UPDATE' and new.status is distinct from old.status then
    insert into public.show_activities
      (show_id, kind, from_status, to_status, author_email)
    values (
      new.id, 'status', old.status, new.status,
      nullif(auth.jwt() ->> 'email', '')
    );
  end if;
  return new;
end;
$$;

drop trigger if exists shows_log_activity_insert on public.shows;
create trigger shows_log_activity_insert
  after insert on public.shows
  for each row
  execute function public.log_show_activity();

drop trigger if exists shows_log_activity_update on public.shows;
create trigger shows_log_activity_update
  after update on public.shows
  for each row
  execute function public.log_show_activity();

-- ----------------------------------------------------------------
-- RLS — mesmo padrão das demais tabelas: app interno, só autenticados.
-- ----------------------------------------------------------------
alter table public.show_activities enable row level security;

drop policy if exists "show_activities: authenticated full access"
  on public.show_activities;
create policy "show_activities: authenticated full access"
  on public.show_activities for all
  to authenticated
  using (true)
  with check (true);
