/**
 * Regras de leitura de um show que não são nem tela nem banco.
 */

import { parseDateOnly } from "@/lib/format";
import type { Show } from "@/types/database";

/** O mínimo para decidir se um show já aconteceu. */
type ShowRealizavel = Pick<
  Show,
  "event_date" | "event_time" | "event_end_time" | "status"
>;

/** "HH:MM[:SS]" -> minutos desde a meia-noite; null se vazio/inválido. */
const minutosDoDia = (hora: string | null): number | null => {
  const match = hora ? /^(\d{2}):(\d{2})/.exec(hora) : null;
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

/**
 * O show já aconteceu?
 *
 * A comparação é com a data/hora ATUAL:
 *   - com horário de TÉRMINO cadastrado, o show é "realizado" quando ele
 *     termina — e um término menor que o início ("22:00 até 00:00") é na
 *     madrugada do dia seguinte;
 *   - só com o início, quando o início passa (um show das 20h só sai do
 *     quadro depois das 20h);
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
  const inicio = minutosDoDia(show.event_time);
  const fim = minutosDoDia(show.event_end_time);

  if (inicio !== null || fim !== null) {
    let corte = fim ?? inicio!;
    // Término antes do início só faz sentido virando o dia.
    if (fim !== null && inicio !== null && fim <= inicio) corte += 24 * 60;
    dia.setHours(0, corte, 0, 0);
    return dia.getTime() < agora.getTime();
  }

  // Sem horário: o corte é a virada do dia.
  const hoje = new Date(agora);
  hoje.setHours(0, 0, 0, 0);
  return dia.getTime() < hoje.getTime();
}
