import { toDateOnly } from "@/lib/format";
import type { ShowTask } from "@/types/database";

/**
 * Uma tarefa está atrasada se venceu antes de hoje e não foi concluída.
 * Tarefa sem data de vencimento nunca atrasa.
 *
 * Vive aqui, e não no componente, porque a ficha do show e o resumo do
 * Dashboard precisam do mesmo critério — duas cópias sairiam de sincronia.
 */
export function isOverdue(task: Pick<ShowTask, "due_date" | "done">): boolean {
  if (task.done || !task.due_date) return false;
  return task.due_date < toDateOnly(new Date());
}

/** Vence exatamente hoje e ainda está pendente. */
export function isDueToday(
  task: Pick<ShowTask, "due_date" | "done">
): boolean {
  if (task.done || !task.due_date) return false;
  return task.due_date === toDateOnly(new Date());
}
