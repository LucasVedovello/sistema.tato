-- =============================================================
-- Artista vira cadastro (com papéis) e o show ganha horário de término
--
-- Até aqui o artista era só texto na ficha do show (`artist_name` /
-- `artist_full_name`), e na prática o campo "nome completo do artista" vinha
-- sendo usado para guardar o nome do CLIENTE — porque não havia onde separar
-- as duas coisas. A partir desta migration:
--
--   1. `clients` passa a ser o cadastro de PESSOAS, com dois papéis não
--      exclusivos: `is_client` (contrata) e `is_artist` (se apresenta). O
--      Carnellos é artista; a Mariana, da Arena Beach, é cliente; alguém pode
--      ser os dois.
--   2. `shows.artist_id` aponta para esse cadastro. As colunas de texto
--      `artist_name`/`artist_full_name` CONTINUAM existindo como cópia
--      sincronizada por gatilho: Kanban, calendário, planilhas, a RPC pública
--      do contrato e a Edge Function leem `artist_name` e não precisam mudar.
--   3. `shows.event_end_time` guarda o horário de término ("22:00 até 00:00").
--
-- Tudo idempotente: pode rodar de novo sem efeito.
-- =============================================================

-- ----------------------------------------------------------------
-- 1. Horário de término
-- ----------------------------------------------------------------
alter table public.shows
  add column if not exists event_end_time time;

comment on column public.shows.event_time is
  'Horário de INÍCIO do show (sem fuso). Exibido no dashboard, no calendário e no contrato.';
comment on column public.shows.event_end_time is
  'Horário de TÉRMINO do show (sem fuso). Pode ser menor que o de início quando '
  'vira a madrugada (22:00 até 00:00).';

-- ----------------------------------------------------------------
-- 2. Papéis no cadastro
--
-- Default `is_client = true`: todo cadastro que já existia era cliente. Os
-- artistas criados pelo backfill abaixo entram com `is_client = false`.
-- ----------------------------------------------------------------
alter table public.clients
  add column if not exists is_client boolean not null default true,
  add column if not exists is_artist boolean not null default false;

comment on column public.clients.is_client is
  'Pode ser escolhido como CONTRATANTE de um show.';
comment on column public.clients.is_artist is
  'Pode ser escolhido como ARTISTA de um show. Não exclui is_client.';

-- Um cadastro sem papel nenhum não apareceria em seletor algum.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clients_papel_check'
  ) then
    alter table public.clients
      add constraint clients_papel_check
      check (is_client or is_artist);
  end if;
end$$;

create index if not exists clients_is_artist_idx on public.clients (is_artist);

-- ----------------------------------------------------------------
-- 3. Vínculo show -> artista
--
-- `on delete set null`, como o `client_id`: apagar o cadastro do artista não
-- pode apagar os shows dele — e o nome continua na cópia de texto.
-- ----------------------------------------------------------------
alter table public.shows
  add column if not exists artist_id uuid references public.clients (id) on delete set null;

create index if not exists shows_artist_id_idx on public.shows (artist_id);

comment on column public.shows.artist_id is
  'Cadastro do artista (clients.is_artist). artist_name/artist_full_name são cópias sincronizadas.';
comment on column public.shows.artist_name is
  'CÓPIA do nome da ficha do artista (clients.name), sincronizada por gatilho quando '
  'artist_id está preenchido. Lida pelo Kanban, calendário, planilhas e RPC pública.';
comment on column public.shows.artist_full_name is
  'CÓPIA do nome completo do artista (clients.full_name), sincronizada por gatilho. '
  'Shows anteriores a 2026-09-11 podem carregar o valor antigo até serem salvos de novo.';

-- ----------------------------------------------------------------
-- 4. Backfill: cada nome de artista que existe nos shows vira um cadastro
--
-- Só o nome da FICHA (`artist_name`) entra: era o único campo que de fato
-- identificava o artista. O `artist_full_name` dos shows antigos NÃO é usado
-- para criar cadastro — na base real ele guardava o nome do cliente.
--
-- Roda ANTES de criar o gatilho de sincronização, de propósito: assim o
-- backfill não sobrescreve o `artist_full_name` antigo dos shows (que seria
-- zerado, já que o cadastro novo nasce sem nome completo). O valor fica lá
-- como histórico até a próxima gravação do show.
-- ----------------------------------------------------------------
insert into public.clients (name, is_client, is_artist)
select distinct btrim(s.artist_name), false, true
  from public.shows s
 where s.artist_id is null
   and btrim(s.artist_name) <> ''
   and not exists (
     select 1 from public.clients c
      where c.is_artist and c.name = btrim(s.artist_name)
   );

update public.shows s
   set artist_id = c.id
  from public.clients c
 where s.artist_id is null
   and c.is_artist
   and c.name = btrim(s.artist_name);

-- ----------------------------------------------------------------
-- 5. Sincronização das cópias de texto
--
-- (a) Ao gravar um show com artist_id, o nome vem do cadastro — o app até
--     manda artist_name (a coluna é NOT NULL), mas quem decide é o registro.
-- (b) Renomear o artista no cadastro reflete em todos os shows dele.
-- ----------------------------------------------------------------
create or replace function public.sync_show_artist_names()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  artista public.clients;
begin
  if new.artist_id is null then
    return new;
  end if;
  select * into artista from public.clients where id = new.artist_id;
  if found then
    new.artist_name := artista.name;
    new.artist_full_name := artista.full_name;
  end if;
  return new;
end;
$$;

drop trigger if exists shows_sync_artist_names on public.shows;
create trigger shows_sync_artist_names
  before insert or update on public.shows
  for each row
  execute function public.sync_show_artist_names();

create or replace function public.propagate_artist_names()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.name is distinct from old.name
     or new.full_name is distinct from old.full_name then
    update public.shows
       set artist_name = new.name,
           artist_full_name = new.full_name
     where artist_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists clients_propagate_artist_names on public.clients;
create trigger clients_propagate_artist_names
  after update of name, full_name on public.clients
  for each row
  execute function public.propagate_artist_names();
