-- =============================================================
-- Clientes: endereço em campos separados
--
-- O endereço do contratante era digitado à mão, uma linha de texto livre, no
-- diálogo de emissão do contrato — e saía diferente a cada documento
-- ("Rua X 235", "rua x, 235", "Rua X nº 235 - Centro"). Quebrado em partes, o
-- contrato passa a montá-lo sempre no mesmo formato (`formatEndereco`, em
-- src/lib/format.ts) e o dado fica no cadastro, não no contrato.
--
-- Tudo anulável: cliente sem endereço continua válido (o contrato mostra a
-- lacuna, como já fazia com os outros campos em branco).
-- =============================================================

alter table public.clients
  add column if not exists logradouro  text,
  add column if not exists numero      text,
  add column if not exists complemento text,
  add column if not exists bairro      text,
  add column if not exists cidade      text,
  add column if not exists uf          text,
  add column if not exists cep         text;

comment on column public.clients.logradouro is 'Rua/avenida, sem o número.';
comment on column public.clients.numero is 'Número do imóvel (texto: existe "235-A", "s/n").';
comment on column public.clients.uf is 'Sigla do estado, duas letras maiúsculas.';
comment on column public.clients.cep is 'CEP com máscara (00000-000), como digitado no formulário.';

-- A UF é o único campo com forma fixa o bastante para o banco cobrar. O
-- formulário já oferece um select, então isto é a segunda barreira.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clients_uf_check'
  ) then
    alter table public.clients
      add constraint clients_uf_check
      check (uf is null or uf ~ '^[A-Z]{2}$');
  end if;
end$$;
