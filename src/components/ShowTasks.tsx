import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CalendarClock, ListChecks, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { isOverdue } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { formatData } from "@/lib/format";
import type { ShowTask } from "@/types/database";

/** Tarefas do show: criar, marcar como concluída e excluir. */
export function ShowTasks({ showId }: { showId: string }) {
  const [tasks, setTasks] = useState<ShowTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("show_tasks")
      .select("*")
      // Pendentes primeiro, e dentro delas as que vencem antes.
      .order("done")
      .order("due_date", { nullsFirst: false })
      .eq("show_id", showId);

    if (error) setError(error.message);
    else {
      setError(null);
      setTasks((data as ShowTask[]) ?? []);
    }
    setLoading(false);
  }, [showId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const texto = title.trim();
    if (!texto) return;

    setSaving(true);
    const { error } = await supabase.from("show_tasks").insert({
      show_id: showId,
      title: texto,
      due_date: dueDate || null,
      done: false,
    });
    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }
    setTitle("");
    setDueDate("");
    void load();
  }

  async function toggleDone(task: ShowTask) {
    // Marca na hora e desfaz se o banco recusar.
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t))
    );
    const { error } = await supabase
      .from("show_tasks")
      .update({ done: !task.done })
      .eq("id", task.id);

    if (error) {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, done: task.done } : t))
      );
      setError(error.message);
    } else {
      void load();
    }
  }

  async function handleDelete(task: ShowTask) {
    const { error } = await supabase
      .from("show_tasks")
      .delete()
      .eq("id", task.id);
    if (error) setError(error.message);
    else void load();
  }

  const pendentes = tasks.filter((t) => !t.done).length;

  return (
    <Card data-testid="tarefas">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="h-4 w-4" />
          Tarefas
          {pendentes > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {pendentes} pendente(s)
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={handleAdd} className="flex flex-wrap gap-2">
          <Input
            id="nova-tarefa"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="O que precisa ser feito?"
            className="min-w-40 flex-1"
          />
          <Input
            id="nova-tarefa-data"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-40"
            aria-label="Data de vencimento"
          />
          <Button type="submit" size="icon" disabled={saving || !title.trim()}>
            <Plus className="h-4 w-4" />
            <span className="sr-only">Adicionar tarefa</span>
          </Button>
        </form>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando tarefas…</p>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma tarefa para este show.
          </p>
        ) : (
          <ul className="divide-y">
            {tasks.map((task) => {
              const atrasada = isOverdue(task);
              return (
                <li
                  key={task.id}
                  data-testid={`tarefa-${task.id}`}
                  className="flex items-center gap-3 py-2"
                >
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={() => toggleDone(task)}
                    aria-label={`Concluir ${task.title}`}
                    className="h-4 w-4 shrink-0 cursor-pointer accent-primary"
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "truncate text-sm",
                        task.done && "text-muted-foreground line-through"
                      )}
                    >
                      {task.title}
                    </p>
                    {task.due_date && (
                      <p
                        className={cn(
                          "flex items-center gap-1 text-xs",
                          atrasada
                            ? "font-medium text-destructive"
                            : "text-muted-foreground"
                        )}
                      >
                        <CalendarClock className="h-3 w-3" />
                        {formatData(task.due_date)}
                        {atrasada && " · atrasada"}
                      </p>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(task)}
                    title={`Excluir ${task.title}`}
                    aria-label={`Excluir ${task.title}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
