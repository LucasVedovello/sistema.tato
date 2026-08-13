-- =============================================================
-- Clientes: CPF/CNPJ
-- Necessário para a qualificação das partes no contrato.
-- =============================================================

alter table public.clients
  add column if not exists document text;
