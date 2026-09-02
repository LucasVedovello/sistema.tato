import type { Column } from "write-excel-file/browser";

import { CABECALHO, MOEDA, hojeSufixo, salvarPlanilha, toUtcDate } from "@/lib/excel";
import { productionSummary } from "@/lib/production";
import { supabase } from "@/lib/supabase";
import { formatTime } from "@/lib/utils";
import { SHOW_STATUS_LABELS, type ShowWithClient } from "@/types/database";

/**
 * Uma linha da planilha. Os nomes aqui são só de transporte; os rótulos que o
 * usuário vê estão em COLUNAS, abaixo.
 */
interface ExportRow {
  artist: string;
  eventDate: Date | null;
  /** "20:30" — texto, porque o que interessa é ler, não calcular com a hora. */
  eventTime: string;
  client: string;
  value: number | null;
  production: string;
  location: string;
  status: string;
}

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
    header: { value: "Horário", ...CABECALHO },
    cell: (row) => ({ type: String, value: row.eventTime }),
    width: 10,
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
      row.value == null ? null : { type: Number, value: row.value, format: MOEDA },
    width: 16,
  },
  {
    // Uma coluna só, com as funções separadas por vírgula: uma coluna por
    // função encheria a planilha de "Não" e quebraria a cada opção nova.
    header: { value: "Produção", ...CABECALHO },
    cell: (row) => ({ type: String, value: row.production }),
    width: 38,
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

function toRow(show: ShowWithClient): ExportRow {
  return {
    artist: show.artist_name,
    eventDate: show.event_date ? toUtcDate(show.event_date) : null,
    eventTime: formatTime(show.event_time),
    client: show.clients?.name ?? "",
    value: show.value_cents == null ? null : show.value_cents / 100,
    production: productionSummary(show.production_roles),
    location: show.location ?? "",
    status: SHOW_STATUS_LABELS[show.status],
  };
}

/**
 * Consulta base dos shows, sempre com o cliente relacionado.
 *
 * Todas as exportações leem o banco no momento do clique, em vez de
 * reaproveitar o que a tela já carregou, para o arquivo refletir o estado
 * atual — inclusive as mudanças automáticas de status.
 */
const consultaShows = () => supabase.from("shows").select("*, clients(id, name)");

/** Planilha com TODOS os shows — é o que o Dashboard mostra no Kanban. */
export async function exportAllShowsToExcel(): Promise<number> {
  const { data, error } = await consultaShows().order("event_date", {
    ascending: true,
    nullsFirst: false,
  });
  if (error) throw new Error(error.message);

  return salvarPlanilha(
    ((data as ShowWithClient[]) ?? []).map(toRow),
    COLUNAS,
    "Shows",
    `shows-${hojeSufixo()}.xlsx`
  );
}

/** Planilha só dos shows fechados. */
export async function exportClosedShowsToExcel(): Promise<number> {
  const { data, error } = await consultaShows()
    .eq("status", "fechado")
    .order("event_date", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);

  return salvarPlanilha(
    ((data as ShowWithClient[]) ?? []).map(toRow),
    COLUNAS,
    "Shows fechados",
    `shows-fechados-${hojeSufixo()}.xlsx`
  );
}

/**
 * Planilha dos shows do intervalo visível no calendário.
 *
 * O intervalo é o mesmo que a tela usa para desenhar a grade (as seis semanas,
 * não só os dias do mês), então a planilha traz exatamente o que está à vista.
 */
export async function exportCalendarShowsToExcel(
  from: string,
  to: string,
  rotuloPeriodo: string
): Promise<number> {
  const { data, error } = await consultaShows()
    .gte("event_date", from)
    .lte("event_date", to)
    .order("event_date", { ascending: true });
  if (error) throw new Error(error.message);

  return salvarPlanilha(
    ((data as ShowWithClient[]) ?? []).map(toRow),
    COLUNAS,
    "Agenda",
    `agenda-${rotuloPeriodo}.xlsx`
  );
}
