-- =============================================================
-- Clientes: campo de observações
-- O cadastro de cliente passa a ter nome, telefone, e-mail e observações.
-- =============================================================

alter table public.clients
  add column if not exists notes text;

-- Busca por nome na listagem de clientes.
create index if not exists clients_name_idx on public.clients (name);
