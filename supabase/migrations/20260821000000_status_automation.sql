-- =============================================================
-- Automação do status do show a partir do contrato
--
--   criado          -> em_fechamento   quando o contrato é gerado
--   em_fechamento   -> fechado         quando as DUAS partes assinam
--   em_fechamento   -> cancelado       quando o prazo de assinatura expira
--
-- Tudo acontece no banco, e não no app, pelo mesmo motivo do
-- `log_show_activity`: o contrato é assinado por caminhos diferentes (o app
-- autenticado e a RPC pública do cliente), e a expiração precisa valer mesmo
-- com ninguém olhando a tela.
-- =============================================================

-- Prazo para as duas assinaturas, contado da emissão do contrato.
alter table public.show_contracts
  add column if not exists deadline_at timestamptz not null
    default now() + interval '1 day';

comment on column public.show_contracts.deadline_at is
  'Limite para as duas assinaturas. Vencido sem ambas, o contrato é cancelado '
  'e o show volta para cancelado (ver expire_overdue_contracts).';

create index if not exists show_contracts_pendentes_idx
  on public.show_contracts (deadline_at)
  where status in ('aguardando_cliente', 'aguardando_contratado');

-- ----------------------------------------------------------------
-- Mudança automática de status, com motivo registrado na timeline
--
-- O motivo viaja por uma variável de sessão em vez de um parâmetro: quem
-- escreve a atividade é o gatilho `log_show_activity`, que só recebe a linha
-- do show. `set_config(..., true)` limita o valor à transação corrente, então
-- não vaza para a próxima operação da mesma conexão.
-- ----------------------------------------------------------------
create or replace function public.set_show_status_auto(
  p_show_id uuid,
  p_status  public.show_status,
  p_reason  text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.status_reason', p_reason, true);
  update public.shows
     set status = p_status
   where id = p_show_id
     and status is distinct from p_status;
  perform set_config('app.status_reason', '', true);
end;
$$;

-- O log de status passa a gravar o motivo (quando a mudança foi automática) e
-- a deixar o autor em branco — não foi ninguém que clicou.
create or replace function public.log_show_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  motivo text := nullif(current_setting('app.status_reason', true), '');
begin
  if TG_OP = 'INSERT' then
    insert into public.show_activities (show_id, kind, to_status, author_email)
    values (new.id, 'created', new.status, nullif(auth.jwt() ->> 'email', ''));
  elsif TG_OP = 'UPDATE' and new.status is distinct from old.status then
    insert into public.show_activities
      (show_id, kind, content, from_status, to_status, author_email)
    values (
      new.id,
      'status',
      motivo,
      old.status,
      new.status,
      -- Mudança automática não tem autor; a manual continua identificada.
      case when motivo is null then nullif(auth.jwt() ->> 'email', '') end
    );
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------
-- Contrato gerado -> show em fechamento
-- Contrato assinado pelas duas partes -> show fechado
--
-- Só agem sobre o status esperado: se alguém mexeu no status à mão, a
-- automação não desfaz a decisão.
-- ----------------------------------------------------------------
create or replace function public.sync_show_status_from_contract()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  status_atual public.show_status;
begin
  select status into status_atual from public.shows where id = new.show_id;

  if TG_OP = 'INSERT' then
    if status_atual = 'criado' then
      perform public.set_show_status_auto(
        new.show_id,
        'em_fechamento',
        format(
          'Alterado automaticamente: contrato "%s" gerado, aguardando assinaturas até %s',
          new.template_label,
          to_char(new.deadline_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
        )
      );
    end if;
    return new;
  end if;

  if new.status = 'assinado' and old.status is distinct from 'assinado'
     and status_atual in ('criado', 'em_fechamento') then
    perform public.set_show_status_auto(
      new.show_id,
      'fechado',
      'Alterado automaticamente: contrato assinado pelas duas partes'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists show_contracts_sync_show_status on public.show_contracts;
create trigger show_contracts_sync_show_status
  after insert or update on public.show_contracts
  for each row
  execute function public.sync_show_status_from_contract();

-- ----------------------------------------------------------------
-- Expiração do prazo
--
-- Idempotente e barata: pode rodar quantas vezes quiser. É chamada pelo
-- agendamento do pg_cron e também pelo app ao abrir, para a tela nunca mostrar
-- um contrato vencido como se ainda valesse.
--
-- Um show só é cancelado quando NÃO sobrou saída: nenhum contrato assinado e
-- nenhum ainda dentro do prazo. Show que está em fechamento sem contrato
-- nenhum não tem prazo correndo e fica como está.
-- ----------------------------------------------------------------
create or replace function public.expire_overdue_contracts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  expirados integer := 0;
  alvo record;
begin
  with vencidos as (
    update public.show_contracts
       set status = 'cancelado'
     where status in ('aguardando_cliente', 'aguardando_contratado')
       and deadline_at < now()
    returning show_id
  )
  select count(*) into expirados from vencidos;

  if expirados = 0 then
    return 0;
  end if;

  -- Shows que ficaram sem nenhum contrato vivo depois da rodada acima.
  for alvo in
    select s.id
      from public.shows s
     where s.status = 'em_fechamento'
       and exists (select 1 from public.show_contracts c where c.show_id = s.id)
       and not exists (
             select 1 from public.show_contracts c
              where c.show_id = s.id
                and c.status in ('assinado', 'aguardando_cliente', 'aguardando_contratado')
           )
  loop
    perform public.set_show_status_auto(
      alvo.id,
      'cancelado',
      'Alterado automaticamente para Cancelado - prazo de assinatura expirado'
    );
  end loop;

  return expirados;
end;
$$;

revoke all on function public.expire_overdue_contracts() from public;
grant execute on function public.expire_overdue_contracts() to authenticated;

-- ----------------------------------------------------------------
-- Agendamento: de hora em hora, sem depender de alguém abrir o app.
--
-- O app chama a mesma função ao carregar (ver src/lib/contract-expiry.ts) —
-- as duas coisas juntas cobrem tanto a aba aberta o dia inteiro quanto o
-- sistema fechado no fim de semana.
-- ----------------------------------------------------------------
create extension if not exists pg_cron;

do $$
begin
  -- `schedule` sobrescreve um job de mesmo nome, então isto é reexecutável.
  perform cron.schedule(
    'expirar-contratos-vencidos',
    '5 * * * *',
    $cron$ select public.expire_overdue_contracts(); $cron$
  );
exception
  when insufficient_privilege or undefined_function then
    -- Sem pg_cron no projeto, a checagem do app segue valendo sozinha.
    raise notice 'pg_cron indisponível: a expiração fica só com a checagem do app';
end;
$$;

-- ----------------------------------------------------------------
-- O cliente também precisa saber até quando pode assinar: a leitura pública
-- passa a devolver o prazo (segue sem caminho de Storage e sem dado do show
-- além do cabeçalho).
--
-- E some com o contrato pendente cujo prazo já passou, mesmo que a rodada de
-- expiração ainda não tenha corrido: sem isso o cliente leria o documento
-- inteiro e só descobriria o vencimento ao tentar finalizar. O já assinado
-- continua visível — é a via final dele.
-- ----------------------------------------------------------------
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
    'deadline_at',        c.deadline_at,
    'artist_name',        s.artist_name,
    'event_date',         s.event_date,
    'location',           s.location
  )
  from public.show_contracts c
  join public.shows s on s.id = c.show_id
  where c.public_token = p_token
    and c.status <> 'cancelado'
    and (c.status = 'assinado' or c.deadline_at >= now());
$$;

-- Assinar fora do prazo não vale: o contrato pode estar vencido e ainda não
-- ter passado pela rodada de expiração.
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
     and deadline_at >= now()
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
