-- =============================================================
-- Horário do evento, produção em múltipla escolha e separação
-- entre nome completo (contrato) e nome da ficha (uso interno)
-- =============================================================

-- ----------------------------------------------------------------
-- shows.event_time — horário do evento
--
-- Coluna separada, e não um `timestamptz` no lugar de `event_date`: a data do
-- show é usada como DIA em toda parte (calendário, agrupamentos, relatórios) e
-- virar instante traria de volta o problema de fuso que `parseDateOnly`
-- resolve. Anulável porque nem todo show tem horário definido no cadastro.
-- ----------------------------------------------------------------
alter table public.shows
  add column if not exists event_time time;

comment on column public.shows.event_time is
  'Horário do evento (sem fuso). Exibido no dashboard, no calendário e no contrato.';

-- ----------------------------------------------------------------
-- shows.production_roles — produção em múltipla escolha
--
-- Substitui o antigo "terá produção? sim/não". Guarda as CHAVES das funções
-- (videomaker, motorista, …), não os rótulos: o texto que aparece na tela e na
-- planilha mora em `src/lib/production.ts` e pode ser reescrito sem migrar
-- dado.
--
-- `has_production` NÃO é removida: o app deixou de usá-la, mas ela é o único
-- registro do que foi respondido nos shows antigos, e um "sim" não diz QUAIS
-- funções foram contratadas — não há como convertê-lo sem inventar dado.
-- ----------------------------------------------------------------
alter table public.shows
  add column if not exists production_roles text[] not null default '{}'::text[];

comment on column public.shows.production_roles is
  'Funções de produção contratadas para o show (chaves de PRODUCTION_ROLES).';

comment on column public.shows.has_production is
  'OBSOLETA desde 2026-09-02: substituída por production_roles. Mantida apenas '
  'como histórico dos shows cadastrados antes da mudança.';

-- ----------------------------------------------------------------
-- Nome completo x nome da ficha
--
-- O contrato é um documento legal e precisa do nome completo das partes; a
-- ficha, o Kanban e o calendário continuam mostrando o nome curto/artístico,
-- que é como o escritório se refere a cada um.
--
-- As colunas novas são anuláveis e servem de complemento: sem nome completo
-- preenchido, o contrato cai no nome da ficha (é melhor sair com o nome curto
-- do que com a lacuna "____________").
-- ----------------------------------------------------------------
alter table public.clients
  add column if not exists full_name text;

comment on column public.clients.full_name is
  'Nome completo do contratante — o único que entra no contrato. Vazio: usa name.';

comment on column public.clients.name is
  'Nome da ficha (curto/como é chamado). Usado nas telas; não vai para o contrato.';

alter table public.shows
  add column if not exists artist_full_name text;

comment on column public.shows.artist_full_name is
  'Nome completo do artista — o único que entra no contrato. Vazio: usa artist_name.';

comment on column public.shows.artist_name is
  'Nome da ficha do artista (nome artístico). Usado nas telas; não vai para o contrato.';
