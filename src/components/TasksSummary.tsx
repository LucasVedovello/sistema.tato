import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CalendarClock, ListChecks } from "lucide-react";

import { Card } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { isDueToday, isOverdue } from "@/lib/tasks";
import { cn, formatDate } from "@/lib/utils";
import type { ShowTaskWithShow } from "@/types/database";

/** Quantas tarefas urgentes listar antes de resumir com "+N". */
const LIMITE_LISTA = 4;

/**
 * Resumo das tarefas pendentes, no topo do Dashboard.
 *
 * Busca só as não concluídas — o volume é pequeno e evita trazer o histórico
 * inteiro de tarefas já resolvidas.
 */
export function TasksSummary() {
  const [tasks, setTasks] = useState<ShowTaskWithShow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("show_tasks")
        .select("*, shows(id, artist_name)")
        .eq("done", false)
        .order("due_date", { nullsFirst: false });

      if (!active) return;
      setTasks((data as unknown as ShowTaskWithShow[]) ?? []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const { atrasadas, hoje, urgentes } = useMemo(() => {
    const atrasadas = tasks.filter(isOverdue);
    const hoje = tasks.filter(isDueToday);
    return {
      atrasadas,
      hoje,
      // Atrasadas primeiro, depois as de hoje: é o que precisa de ação agora.
      urgentes: [...atrasadas, ...hoje],
    };
  }, [tasks]);

  if (loading || tasks.length === 0) return null;

  return (
    <Card className="p-4" data-testid="resumo-tarefas">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span className="flex items-center gap-2 font-semibold">
          <ListChecks className="h-4 w-4" />
          Tarefas
        </span>

        {atrasadas.length > 0 && (
          <span className="flex items-center gap-1.5 font-medium text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {atrasadas.length}{" "}
            {atrasadas.length === 1 ? "tarefa atrasada" : "tarefas atrasadas"}
          </span>
        )}

        {hoje.length > 0 && (
          <span className="flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
            <CalendarClock className="h-4 w-4" />
            {hoje.length} para hoje
          </span>
        )}

        <span className="text-muted-foreground">
          {tasks.length} pendente(s) no total
        </span>
      </div>

      {urgentes.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t pt-3">
          {urgentes.slice(0, LIMITE_LISTA).map((task) => {
            const atrasada = isOverdue(task);
            return (
              <li key={task.id} className="text-sm">
                <Link
                  to={`/shows/${task.show_id}`}
                  className="flex flex-wrap items-center gap-x-2 hover:underline"
                >
                  <span
                    className={cn(
                      "font-medium",
                      atrasada && "text-destructive"
                    )}
                  >
                    {task.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {task.shows?.artist_name ?? "show removido"} ·{" "}
                    {formatDate(task.due_date)}
                  </span>
                </Link>
              </li>
            );
          })}
          {urgentes.length > LIMITE_LISTA && (
            <li className="text-xs text-muted-foreground">
              +{urgentes.length - LIMITE_LISTA} outra(s)
            </li>
          )}
        </ul>
      )}
    </Card>
  );
}
