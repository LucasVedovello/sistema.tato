/**
 * Peças comuns das exportações para Excel.
 *
 * Cada tela tem seu próprio módulo de exportação (`shows-export`,
 * `clients-export`, `report-export`); o que se repetia entre eles — estilo do
 * cabeçalho, data em UTC, gravação do arquivo — mora aqui.
 */

import type { Column, SheetData } from "write-excel-file/browser";

import { parseDateOnly, toDateOnly } from "@/lib/utils";

/** Estilo do cabeçalho, igual em todas as planilhas. */
export const CABECALHO = { fontWeight: "bold" } as const;

/** Formato numérico do Excel para valores em reais (continua somável). */
export const MOEDA = '"R$" #,##0.00';

/**
 * "2026-09-12" -> Date no mesmo dia, mas ancorado em UTC.
 *
 * O xlsx guarda data como número serial e a conversão parte dos componentes
 * UTC. Passar meia-noite local faria a data voltar um dia no Brasil (UTC-3) —
 * o mesmo problema que já apareceu na exibição das datas na tela.
 */
export function toUtcDate(isoDate: string): Date {
  const local = parseDateOnly(isoDate);
  return new Date(
    Date.UTC(local.getFullYear(), local.getMonth(), local.getDate())
  );
}

/** Sufixo de data usado nos nomes dos arquivos: "clientes-2026-08-21.xlsx". */
export const hojeSufixo = () => toDateOnly(new Date());

/**
 * Grava a planilha a partir de linhas tipadas + definição de colunas.
 *
 * O pacote não tem export raiz: é preciso apontar para o entrypoint /browser
 * (existem também /node e /universal). Import dinâmico para ficar fora do
 * bundle inicial — a planilha só é baixada quando alguém exporta.
 */
export async function salvarPlanilha<Row>(
  rows: Row[],
  columns: Column<Row>[],
  sheet: string,
  fileName: string
): Promise<number> {
  const writeXlsxFile = (await import("write-excel-file/browser")).default;
  await writeXlsxFile(rows, {
    columns,
    sheet,
    stickyRowsCount: 1,
  }).toFile(fileName);
  return rows.length;
}

/**
 * Grava uma planilha montada célula a célula.
 *
 * Serve para o relatório, que não é uma tabela de registros e sim um apanhado
 * de blocos (indicadores, funil) — nele as colunas mudam de significado de uma
 * seção para outra, e o formato de linhas tipadas não descreve isso.
 */
export async function salvarPlanilhaLivre(
  data: SheetData,
  sheet: string,
  fileName: string,
  columnWidths: number[]
): Promise<void> {
  const writeXlsxFile = (await import("write-excel-file/browser")).default;
  await writeXlsxFile(data, {
    sheet,
    columns: columnWidths.map((width) => ({ width })),
  }).toFile(fileName);
}
