/**
 * Regras de leitura de um show que não são nem tela nem banco.
 */

import { parseDateOnly } from "@/lib/utils";
import type { Show } from "@/types/database";

/** O mínimo para decidir se um show já aconteceu. */
type ShowRealizavel = Pick<Show, "event_date" | "event_time" | "status">;

/**
 * O show já aconteceu?
 *
 * A comparação é com a data/hora ATUAL:
 *   - com horário cadastrado, o show passa a ser "realizado" quando o horário
 *     dele passa (um show das 20h só sai do quadro depois das 20h);
 *   - sem horário, só quando o dia inteiro passa — não dá para supor que um
 *     show de hoje à noite já aconteceu porque é meio-dia.
 *
 * Cancelado nunca é realizado: a data passou, mas o show não aconteceu.
 */
export function jaRealizado(
  show: ShowRealizavel,
  agora: Date = new Date()
): boolean {
  if (show.status === "cancelado") return false;
  if (!show.event_date) return false;

  const dia = parseDateOnly(show.event_date);
  const match = show.event_time
    ? /^(\d{2}):(\d{2})/.exec(show.event_time)
    : null;

  if (match) {
    dia.setHours(Number(match[1]), Number(match[2]), 0, 0);
    return dia.getTime() < agora.getTime();
  }

  // Sem horário: o corte é a virada do dia.
  const hoje = new Date(agora);
  hoje.setHours(0, 0, 0, 0);
  return dia.getTime() < hoje.getTime();
}
