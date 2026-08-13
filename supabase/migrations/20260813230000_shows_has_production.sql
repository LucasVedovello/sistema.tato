-- =============================================================
-- Shows: "terá produção?"
--
-- Coluna usada no formulário e na planilha de shows fechados.
-- `not null default false` porque a resposta é binária (sim/não) e a base
-- ainda é pequena; shows antigos entram como "não" e podem ser ajustados.
--
-- Obs.: `location` (local do evento) JÁ EXISTIA desde o schema inicial —
-- nenhuma alteração necessária ali.
-- =============================================================

alter table public.shows
  add column if not exists has_production boolean not null default false;
