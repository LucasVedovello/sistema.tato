import type { Row } from "write-excel-file/browser";

import { CABECALHO, MOEDA, salvarPlanilhaLivre } from "@/lib/excel";
import {
  calcularRelatorio,
  ETAPAS_FUNIL,
  MESES,
  TODOS_OS_MESES,
  type LinhaShow,
} from "@/lib/report";
import { STATUS_STYLES } from "@/lib/status";
import { supabase } from "@/lib/supabase";

const texto = (value: string, negrito = false): Row[number] => ({
  type: String,
  value,
  ...(negrito ? CABECALHO : {}),
});

const numero = (value: number): Row[number] => ({ type: Number, value });

/** Centavos -> célula numérica formatada como reais (continua somável). */
const dinheiro = (cents: number): Row[number] => ({
  type: Number,
  value: cents / 100,
  format: MOEDA,
});

const VAZIO: Row = [];

/**
 * Planilha do relatório do período escolhido.
 *
 * Diferente das outras exportações, esta não é uma lista de registros: são os
 * mesmos blocos da tela (indicadores, funil por status e o total de
 * cancelados), um abaixo do outro, montados célula a célula.
 */
export async function exportReportToExcel(
  ano: string,
  mes: string
): Promise<number> {
  const { data, error } = await supabase
    .from("shows")
    .select("id, status, value_cents, event_date");
  if (error) throw new Error(error.message);

  const r = calcularRelatorio((data as LinhaShow[]) ?? [], ano, mes);

  const linhas: Row[] = [
    [texto("Relatório de shows", true)],
    [texto("Período"), texto(r.rotuloPeriodo)],
    [
      texto("Gerado em"),
      { type: Date, value: new Date(), format: "dd/mm/yyyy hh:mm" },
    ],
    VAZIO,

    [texto("Indicadores", true)],
    [
      texto(
        mes === TODOS_OS_MESES
          ? `Fechado em ${ano}`
          : `Fechado em ${MESES[Number(mes)]}`
      ),
      dinheiro(r.somaMes),
      texto(`${r.fechadosNoMes} show(s) fechado(s)`),
    ],
    [
      texto(`Fechado no ano de ${ano}`),
      dinheiro(r.somaAno),
      texto(`${r.fechadosNoAno} show(s) fechado(s)`),
    ],
    [
      texto("Taxa de conversão"),
      // Percentual como número (0..1) com formato de %, para poder ser usado
      // em contas na planilha em vez de virar texto.
      r.conversao === null
        ? texto("—")
        : { type: Number, value: r.conversao / 100, format: "0%" },
      texto(
        r.conversao === null
          ? "Sem shows no período"
          : `${r.porStatus.fechado} fechado(s) de ${r.totalPeriodo} no período`
      ),
    ],
    VAZIO,

    [texto("Funil por status", true)],
    [texto("Status", true), texto("Shows", true), texto("Valor", true)],
    ...ETAPAS_FUNIL.map((status): Row => [
      texto(STATUS_STYLES[status].label),
      numero(r.porStatus[status]),
      dinheiro(r.valorPorStatus[status]),
    ]),
    VAZIO,

    // Cancelados ficam fora do funil na tela; aqui também, mas registrados.
    [texto("Fora do funil", true)],
    [
      texto(STATUS_STYLES.cancelado.label),
      numero(r.porStatus.cancelado),
      dinheiro(r.valorPorStatus.cancelado),
    ],
    VAZIO,

    [texto("Total no período", true), numero(r.totalPeriodo)],
    [
      texto("Shows sem data de evento"),
      numero(r.semData),
      texto("Não entram em nenhum período"),
    ],
  ];

  const sufixo =
    mes === TODOS_OS_MESES
      ? ano
      : `${ano}-${String(Number(mes) + 1).padStart(2, "0")}`;

  await salvarPlanilhaLivre(
    linhas,
    "Relatório",
    `relatorio-${sufixo}.xlsx`,
    [34, 18, 34]
  );

  // O que interessa saber é se havia shows no período: uma planilha só com o
  // esqueleto do relatório não ajuda ninguém.
  return r.totalPeriodo;
}
