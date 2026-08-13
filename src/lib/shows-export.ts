import type { Column } from "write-excel-file/browser";

import { supabase } from "@/lib/supabase";
import { SHOW_STATUS_LABELS, type ShowWithClient } from "@/types/database";
import { parseDateOnly, toDateOnly } from "@/lib/utils";

/**
 * Uma linha da planilha. Os nomes aqui são só de transporte; os rótulos que o
 * usuário vê estão em COLUNAS, abaixo.
 */
interface ExportRow {
  artist: string;
  eventDate: Date | null;
  client: string;
  value: number | null;
  production: string;
  location: string;
  status: string;
}

const CABECALHO = { fontWeight: "bold" } as const;

/**
 * Colunas da planilha, na ordem em que aparecem.
 *
 * Para incluir um campo novo, basta acrescentar uma entrada aqui e o dado
 * correspondente em `toRow`.
 */
const COLUNAS: Column<ExportRow>[] = [
  {
    header: { value: "Artista", ...CABECALHO },
    cell: (row) => ({ type: String, value: row.artist }),
    width: 32,
  },
  {
    header: { value: "Data", ...CABECALHO },
    // Célula vazia (null) quando o show não tem data, em vez de uma data falsa.
    cell: (row) =>
      row.eventDate
        ? { type: Date, value: row.eventDate, format: "dd/mm/yyyy" }
        : null,
    width: 14,
  },
  {
    header: { value: "Cliente", ...CABECALHO },
    cell: (row) => ({ type: String, value: row.client }),
    width: 30,
  },
  {
    header: { value: "Valor", ...CABECALHO },
    // Continua numérica (dá para somar no Excel); o R$ é só formatação.
    cell: (row) =>
      row.value == null
        ? null
        : { type: Number, value: row.value, format: '"R$" #,##0.00' },
    width: 16,
  },
  {
    header: { value: "Terá produção", ...CABECALHO },
    cell: (row) => ({ type: String, value: row.production }),
    width: 15,
  },
  {
    header: { value: "Local", ...CABECALHO },
    cell: (row) => ({ type: String, value: row.location }),
    width: 34,
  },
  {
    header: { value: "Status", ...CABECALHO },
    cell: (row) => ({ type: String, value: row.status }),
    width: 16,
  },
];

/** "2026-09-12" -> Date no mesmo dia, mas ancorado em UTC. */
function toUtcDate(isoDate: string): Date {
  const local = parseDateOnly(isoDate);
  return new Date(
    Date.UTC(local.getFullYear(), local.getMonth(), local.getDate())
  );
}

function toRow(show: ShowWithClient): ExportRow {
  return {
    artist: show.artist_name,
    /**
     * Data em UTC de propósito: o xlsx guarda data como número serial e a
     * conversão parte dos componentes UTC. Passar meia-noite local faria a
     * data voltar um dia no Brasil (UTC-3) — o mesmo problema que já apareceu
     * na exibição das datas na tela.
     */
    eventDate: show.event_date ? toUtcDate(show.event_date) : null,
    client: show.clients?.name ?? "",
    value: show.value_cents == null ? null : show.value_cents / 100,
    production: show.has_production ? "Sim" : "Não",
    location: show.location ?? "",
    status: SHOW_STATUS_LABELS[show.status],
  };
}

/**
 * Busca os shows fechados no banco AGORA e baixa a planilha.
 * Devolve quantas linhas foram exportadas.
 *
 * A consulta é feita aqui dentro, e não reaproveita o que a tela já carregou,
 * para o arquivo refletir sempre o estado atual do banco.
 */
export async function exportClosedShowsToExcel(): Promise<number> {
  const { data, error } = await supabase
    .from("shows")
    .select("*, clients(id, name)")
    .eq("status", "fechado")
    .order("event_date", { ascending: true, nullsFirst: false });

  if (error) throw new Error(error.message);

  const rows = ((data as ShowWithClient[]) ?? []).map(toRow);

  // O pacote não tem export raiz: é preciso apontar para o entrypoint
  // /browser (existem também /node e /universal). Import dinâmico para ficar
  // fora do bundle inicial.
  const writeXlsxFile = (await import("write-excel-file/browser")).default;

  await writeXlsxFile(rows, {
    columns: COLUNAS,
    sheet: "Shows fechados",
    stickyRowsCount: 1,
  }).toFile(`shows-fechados-${toDateOnly(new Date())}.xlsx`);

  return rows.length;
}
