/**
 * Vencimento do prazo de assinatura, do lado do app.
 *
 * A regra em si mora no banco (`expire_overdue_contracts`), e um agendamento
 * do pg_cron a executa de hora em hora. Esta checagem no carregamento existe
 * para o caso de a pessoa abrir o sistema entre uma rodada e outra: sem ela, a
 * tela mostraria por até uma hora um contrato vencido como se ainda valesse.
 *
 * É idempotente e barata — se nada venceu, o banco não escreve nada.
 */

import { useEffect, useRef, useState } from "react";

import { supabase } from "@/lib/supabase";

/**
 * Roda a expiração e devolve quantos contratos venceram.
 * Uma falha aqui nunca pode impedir o uso do sistema: o erro é registrado e a
 * próxima rodada do cron resolve.
 */
export async function runContractExpiry(): Promise<number> {
  const { data, error } = await supabase.rpc("expire_overdue_contracts");
  if (error) {
    console.error("[contract-expiry] falha ao expirar contratos", error);
    return 0;
  }
  return data ?? 0;
}

/**
 * Executa a checagem UMA vez por carregamento do app, antes de liberar as
 * telas — assim nenhuma delas chega a desenhar um estado que já expirou.
 */
export function useContractExpiry(enabled: boolean): { checking: boolean } {
  const [checking, setChecking] = useState(enabled);
  const started = useRef(false);

  useEffect(() => {
    if (!enabled || started.current) return;
    started.current = true;

    let active = true;
    void runContractExpiry().finally(() => {
      if (active) setChecking(false);
    });

    return () => {
      active = false;
    };
  }, [enabled]);

  return { checking: enabled && checking };
}
