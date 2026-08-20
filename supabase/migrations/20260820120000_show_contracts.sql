-- =============================================================
-- Contratos gerados a partir dos PDFs-modelo do Storage
--
-- Cada linha é UM contrato emitido para UM show: guarda o modelo usado, o
-- snapshot dos dados sobrepostos ao PDF (o show pode mudar depois da emissão)
-- e as duas assinaturas — a do cliente e a do escritório contratado.
--
-- A ordem é sequencial e imposta pelo status:
--   aguardando_cliente -> aguardando_contratado -> assinado
-- O cliente assina primeiro, por um link público protegido por token; só
-- depois o campo do contratado é liberado dentro do app.
-- =============================================================

create table if not exists public.show_contracts (
  id            uuid primary key default gen_random_uuid(),
  show_id       uuid not null references public.shows (id) on delete cascade,

  -- Modelo usado. A chave casa com CONTRACT_TEMPLATES em
  -- src/lib/contract-templates.ts; o caminho é resolvido na emissão para o
  -- caso de o arquivo ser renomeado no bucket depois.
  template_key   text not null check (template_key in ('carnellos', 'producao')),
  template_label text not null,
  template_path  text not null,

  -- Snapshot dos textos sobrepostos ao PDF-modelo no momento da emissão.
  -- Guardado para o PDF final poder ser regerado idêntico ao que foi assinado,
  -- mesmo que o cadastro do show ou do cliente mude depois.
  overlay jsonb not null default '{}'::jsonb,

  status text not null default 'aguardando_cliente'
    check (status in ('aguardando_cliente', 'aguardando_contratado', 'assinado', 'cancelado')),

  -- Segredo do link público de ASSINATURA (48 caracteres hex).
  public_token text not null unique default encode(gen_random_bytes(24), 'hex'),

  -- Segredo de LEITURA dos PDFs no Storage, separado do token de assinatura.
  -- Os dois são distintos de propósito: o nome do arquivo é visível para quem
  -- consegue listar o bucket, e o token de assinatura NÃO pode vazar por aí —
  -- quem o tem consegue assinar em nome do cliente.
  storage_key text not null unique default encode(gen_random_bytes(16), 'hex'),

  -- Partes, congeladas na emissão (nome que sai impresso sob cada linha).
  client_name      text not null,
  office_name      text not null,

  -- Assinaturas: PNG transparente em data URL, como no odonto-sign.
  client_signature  text,
  client_signed_at  timestamptz,
  office_signature  text,
  office_signed_at  timestamptz,

  -- Caminhos no bucket `contratos`:
  --   preparado/<storage_key>.pdf -> modelo + dados do show, sem assinaturas
  --   assinado/<storage_key>.pdf  -> versão final, com as duas assinaturas
  prepared_pdf_path text not null,
  signed_pdf_path   text,

  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists show_contracts_show_id_idx
  on public.show_contracts (show_id, created_at desc);

drop trigger if exists show_contracts_set_updated_at on public.show_contracts;
create trigger show_contracts_set_updated_at
  before update on public.show_contracts
  for each row
  execute function public.set_updated_at();

-- ----------------------------------------------------------------
-- Timeline: emissão e assinaturas viram atividades do show.
--
-- Fica no banco, e não no app, pelo mesmo motivo do log_show_activity: a
-- assinatura do cliente chega por uma RPC pública (usuário anônimo), então
-- não há código do app autenticado para gravar o evento.
-- ----------------------------------------------------------------
alter table public.show_activities
  drop constraint if exists show_activities_kind_check;
alter table public.show_activities
  add constraint show_activities_kind_check
  check (kind in ('created', 'status', 'note', 'message', 'contract', 'signature'));

create or replace function public.log_contract_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.show_activities (show_id, kind, content, author_email)
    values (
      new.show_id,
      'contract',
      format('Contrato gerado a partir do modelo "%s"', new.template_label),
      new.created_by_email
    );
    return new;
  end if;

  if new.client_signed_at is distinct from old.client_signed_at
     and new.client_signed_at is not null then
    insert into public.show_activities (show_id, kind, content, author_email)
    values (
      new.show_id,
      'signature',
      format('Contrato assinado pelo cliente (%s)', new.client_name),
      null
    );
  end if;

  if new.office_signed_at is distinct from old.office_signed_at
     and new.office_signed_at is not null then
    insert into public.show_activities (show_id, kind, content, author_email)
    values (
      new.show_id,
      'signature',
      format('Contrato assinado pelo contratado (%s)', new.office_name),
      nullif(auth.jwt() ->> 'email', '')
    );
  end if;

  return new;
end;
$$;

drop trigger if exists show_contracts_log_activity_insert on public.show_contracts;
create trigger show_contracts_log_activity_insert
  after insert on public.show_contracts
  for each row
  execute function public.log_contract_activity();

drop trigger if exists show_contracts_log_activity_update on public.show_contracts;
create trigger show_contracts_log_activity_update
  after update on public.show_contracts
  for each row
  execute function public.log_contract_activity();

-- ----------------------------------------------------------------
-- A ordem das assinaturas é lei no banco, não só na tela.
--
-- O app já esconde o botão do contratado enquanto o cliente não assina, mas a
-- regra vale mesmo se o update vier por outro caminho: sem assinatura do
-- cliente, o contrato não recebe a do contratado nem vira 'assinado'.
-- ----------------------------------------------------------------
create or replace function public.enforce_contract_signature_order()
returns trigger
language plpgsql
as $$
begin
  if new.office_signed_at is not null and new.client_signed_at is null then
    raise exception 'O contratado só pode assinar depois do cliente';
  end if;
  if new.status = 'assinado'
     and (new.client_signed_at is null or new.office_signed_at is null) then
    raise exception 'O contrato só fica assinado com as duas assinaturas';
  end if;
  return new;
end;
$$;

drop trigger if exists show_contracts_signature_order on public.show_contracts;
create trigger show_contracts_signature_order
  before insert or update on public.show_contracts
  for each row
  execute function public.enforce_contract_signature_order();

-- ----------------------------------------------------------------
-- RLS — a tabela em si só é visível para o app autenticado. O acesso do
-- cliente que vai assinar passa exclusivamente pelas RPCs abaixo, que são
-- security definer e exigem o token.
-- ----------------------------------------------------------------
alter table public.show_contracts enable row level security;

drop policy if exists "show_contracts: authenticated full access" on public.show_contracts;
create policy "show_contracts: authenticated full access"
  on public.show_contracts for all
  to authenticated
  using (true)
  with check (true);

-- ----------------------------------------------------------------
-- Acesso público por token
-- ----------------------------------------------------------------

-- Devolve só o necessário para desenhar e assinar o documento: nada do show
-- além do cabeçalho, nada do cadastro do cliente e nenhum caminho do Storage
-- (o PDF vem pela Edge Function `contrato-pdf`, que recebe o mesmo token).
create or replace function public.public_get_contract(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id',                 c.id,
    'status',             c.status,
    'template_key',       c.template_key,
    'template_label',     c.template_label,
    'client_name',        c.client_name,
    'office_name',        c.office_name,
    'client_signature',   c.client_signature,
    'client_signed_at',   c.client_signed_at,
    'office_signature',   c.office_signature,
    'office_signed_at',   c.office_signed_at,
    'artist_name',        s.artist_name,
    'event_date',         s.event_date,
    'location',           s.location
  )
  from public.show_contracts c
  join public.shows s on s.id = c.show_id
  where c.public_token = p_token
    and c.status <> 'cancelado';
$$;

-- Grava a assinatura do CLIENTE e libera o campo do contratado.
--
-- A troca de status é a trava da ordem: a função só age sobre um contrato em
-- 'aguardando_cliente', então reenviar o link depois de assinado não
-- sobrescreve nada e o contratado nunca assina antes do cliente.
create or replace function public.public_sign_contract(p_token text, p_signature text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  updated public.show_contracts;
begin
  if p_signature is null or p_signature !~ '^data:image/png;base64,[A-Za-z0-9+/=]+$' then
    raise exception 'Assinatura inválida';
  end if;
  -- ~1,5 MB de PNG já é muito para um rabisco de canvas; corta abuso do endpoint.
  if length(p_signature) > 2000000 then
    raise exception 'Assinatura muito grande';
  end if;

  update public.show_contracts
     set client_signature = p_signature,
         client_signed_at = now(),
         status           = 'aguardando_contratado'
   where public_token = p_token
     and status = 'aguardando_cliente'
  returning * into updated;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id',               updated.id,
    'status',           updated.status,
    'client_signed_at', updated.client_signed_at
  );
end;
$$;

revoke all on function public.public_get_contract(text) from public;
revoke all on function public.public_sign_contract(text, text) from public;
grant execute on function public.public_get_contract(text) to anon, authenticated;
grant execute on function public.public_sign_contract(text, text) to anon, authenticated;

-- ----------------------------------------------------------------
-- Storage — bucket privado `contratos`
--
-- Guarda os PDFs-modelo (na raiz) e, por contrato emitido, o PDF preparado e
-- o assinado. A URL de leitura é sempre assinada na hora (createSignedUrl);
-- nada aqui torna o bucket público.
-- ----------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('contratos', 'contratos', false)
on conflict (id) do nothing;

drop policy if exists "contratos: authenticated full access" on storage.objects;
create policy "contratos: authenticated full access"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'contratos')
  with check (bucket_id = 'contratos');

-- O cliente que vai assinar NÃO recebe acesso ao Storage.
--
-- A tentação era liberar `select` ao papel `anon` sobre os PDFs de contrato,
-- validando o token pelo nome do arquivo. Não serve: a listagem do Storage se
-- apoia na mesma permissão de select, então qualquer um com a chave pública do
-- projeto enumeraria os arquivos e baixaria contratos alheios — com nome,
-- CPF/CNPJ, telefone e assinatura de outras pessoas dentro.
--
-- Em vez disso, o PDF do cliente sai pela Edge Function `contrato-pdf`, que
-- valida o token com a service_role e devolve só o arquivo daquele contrato
-- (ver supabase/functions/contrato-pdf/index.ts). Aqui, nenhuma policy para
-- `anon`: fora do app autenticado, o bucket não existe.
drop policy if exists "contratos: anon lê o PDF do seu contrato" on storage.objects;
drop function if exists public.contract_storage_key_valid(text);
drop function if exists public.contract_token_valid(text);
