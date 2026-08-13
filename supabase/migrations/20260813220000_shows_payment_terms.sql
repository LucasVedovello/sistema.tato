-- =============================================================
-- Shows: forma de pagamento
-- Campo usado pelo contrato (cláusula de pagamento). Fica no show, e não no
-- contrato, porque é condição negociada junto com o fechamento.
-- =============================================================

alter table public.shows
  add column if not exists payment_terms text;
