import type { Column } from "write-excel-file/browser";

import { CABECALHO, hojeSufixo, salvarPlanilha } from "@/lib/excel";
import {
  formatDocumento,
  formatEndereco,
  formatTelefone,
} from "@/lib/format";
import { supabase } from "@/lib/supabase";
import type { ClientWithShowCount } from "@/types/database";

interface ClientRow {
  name: string;
  fullName: string;
  phone: string;
  email: string;
  document: string;
  /** Endereço já montado no formato do contrato. */
  address: string;
  shows: number;
  notes: string;
}

const COLUNAS: Column<ClientRow>[] = [
  {
    header: { value: "Nome da ficha", ...CABECALHO },
    cell: (row) => ({ type: String, value: row.name }),
    width: 32,
  },
  {
    header: { value: "Nome completo", ...CABECALHO },
    cell: (row) => ({ type: String, value: row.fullName }),
    width: 32,
  },
  {
    header: { value: "Telefone", ...CABECALHO },
    // Texto, e não número: telefone tem zero à esquerda, parênteses e traço.
    cell: (row) => ({ type: String, value: row.phone }),
    width: 18,
  },
  {
    header: { value: "E-mail", ...CABECALHO },
    cell: (row) => ({ type: String, value: row.email }),
    width: 30,
  },
  {
    header: { value: "CPF/CNPJ", ...CABECALHO },
    cell: (row) => ({ type: String, value: row.document }),
    width: 20,
  },
  {
    header: { value: "Endereço", ...CABECALHO },
    cell: (row) => ({ type: String, value: row.address }),
    width: 52,
  },
  {
    header: { value: "Shows vinculados", ...CABECALHO },
    cell: (row) => ({ type: Number, value: row.shows }),
    width: 17,
  },
  {
    header: { value: "Observações", ...CABECALHO },
    cell: (row) => ({ type: String, value: row.notes }),
    width: 40,
  },
];

/**
 * Planilha dos clientes cadastrados, com quantos shows cada um tem.
 *
 * A contagem vem do próprio PostgREST (`shows(count)`), que devolve a
 * agregação como array de um elemento — inclusive quando o total é zero.
 */
export async function exportClientsToExcel(): Promise<number> {
  const { data, error } = await supabase
    .from("clients")
    .select("*, shows(count)")
    .order("name");
  if (error) throw new Error(error.message);

  const rows = ((data as unknown as ClientWithShowCount[]) ?? []).map(
    (client): ClientRow => ({
      name: client.name,
      fullName: client.full_name ?? "",
      // Mesmas funções da tela e do contrato: a planilha não inventa
      // formato próprio.
      phone: formatTelefone(client.phone),
      email: client.email ?? "",
      document: formatDocumento(client.document),
      address: formatEndereco(client),
      shows: client.shows?.[0]?.count ?? 0,
      notes: client.notes ?? "",
    })
  );

  return salvarPlanilha(rows, COLUNAS, "Clientes", `clientes-${hojeSufixo()}.xlsx`);
}
