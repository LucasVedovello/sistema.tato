/**
 * Cálculo do relatório, fora da tela.
 *
 * A página e a exportação para Excel precisam dos MESMOS números; deixar a
 * conta num só lugar evita a planilha e a tela discordarem quando um dos dois
 * mudar.
 */

import { parseDateOnly } from "@/lib/utils";
import type { ShowStatus } from "@/types/database";

/** Só o que o relatório usa de cada show. */
export type LinhaShow = {
  id: string;
  status: ShowStatus;
  value_cents: number | null;
  event_date: string | null;
};

/**
 * Etapas do funil, na ordem da negociação.
 *
 * "cancelado" fica FORA de propósito: não é uma etapa que o show percorre, é
 * uma perda — e mostrá-lo como barra ao lado de "fechado" também juntava o
 * verde e o vermelho, o par que daltônicos (deuteranopia) menos distinguem.
 * Ele aparece à parte, com rótulo próprio.
 */
export const ETAPAS_FUNIL: ShowStatus[] = ["criado", "em_fechamento", "fechado"];

export const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export const TODOS_OS_MESES = "todos";

const zeradoPorStatus = (): Record<ShowStatus, number> => ({
  criado: 0,
  em_fechamento: 0,
  fechado: 0,
  cancelado: 0,
});

export interface Relatorio {
  /** Shows do ano e do período (mês escolhido, ou o ano inteiro). */
  doAno: LinhaShow[];
  doMes: LinhaShow[];
  porStatus: Record<ShowStatus, number>;
  /** Soma dos valores de cada status, em centavos, dentro do período. */
  valorPorStatus: Record<ShowStatus, number>;
  totalPeriodo: number;
  fechadosNoMes: number;
  fechadosNoAno: number;
  somaMes: number;
  somaAno: number;
  /** Percentual de fechados sobre tudo que entrou no período; null se vazio. */
  conversao: number | null;
  /** Shows sem data não entram em período nenhum. */
  semData: number;
  rotuloPeriodo: string;
}

const somaFechados = (lista: LinhaShow[]) =>
  lista
    .filter((s) => s.status === "fechado")
    .reduce((total, s) => total + (s.value_cents ?? 0), 0);

/** Recorta e resume os shows para o ano/mês escolhidos. */
export function calcularRelatorio(
  shows: LinhaShow[],
  ano: string,
  mes: string
): Relatorio {
  const anoNum = Number(ano);

  const doAno = shows.filter(
    (s) => s.event_date && parseDateOnly(s.event_date).getFullYear() === anoNum
  );
  const doMes =
    mes === TODOS_OS_MESES
      ? doAno
      : doAno.filter(
          (s) => parseDateOnly(s.event_date!).getMonth() === Number(mes)
        );

  const porStatus = zeradoPorStatus();
  const valorPorStatus = zeradoPorStatus();
  for (const show of doMes) {
    porStatus[show.status] += 1;
    valorPorStatus[show.status] += show.value_cents ?? 0;
  }

  const totalPeriodo = doMes.length;

  return {
    doAno,
    doMes,
    porStatus,
    valorPorStatus,
    totalPeriodo,
    fechadosNoMes: porStatus.fechado,
    fechadosNoAno: doAno.filter((s) => s.status === "fechado").length,
    somaMes: somaFechados(doMes),
    somaAno: somaFechados(doAno),
    conversao:
      totalPeriodo === 0 ? null : (porStatus.fechado / totalPeriodo) * 100,
    semData: shows.filter((s) => !s.event_date).length,
    rotuloPeriodo:
      mes === TODOS_OS_MESES ? `${ano}` : `${MESES[Number(mes)]} de ${ano}`,
  };
}
