-- =============================================================
-- Clientes: ativo/inativo
--
-- Excluir um cliente que já tem shows apaga o vínculo e deixa buracos no
-- histórico (os shows ficam sem contratante, e o contrato já emitido passa a
-- apontar para um cadastro que não existe mais). Inativar resolve o caso real
-- — "não quero mais ver este nome nas listas" — sem tocar no passado.
--
-- Default `true`: todo cadastro nasce ativo, inclusive os que já existiam.
-- =============================================================

alter table public.clients
  add column if not exists active boolean not null default true;

comment on column public.clients.active is
  'Cliente inativo some das listagens e do seletor do show, mas continua '
  'vinculado aos shows e contratos antigos.';

-- Listagem e seletor filtram por ativo; o índice evita varrer a tabela.
create index if not exists clients_active_idx on public.clients (active);
