import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { CALENDAR_STATUS_PRIORITY, STATUS_STYLES } from "@/lib/status";
import { cn, formatCurrency, formatDate, toDateOnly } from "@/lib/utils";
import type { ShowStatus, ShowWithClient } from "@/types/database";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const MONTH_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
});

/** Primeiro dia do mês de uma data. */
function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function Calendar() {
  const navigate = useNavigate();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [shows, setShows] = useState<ShowWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  /**
   * Sempre 6 semanas (42 células) para a altura da grade não pular ao trocar
   * de mês. Começa no domingo anterior ao dia 1º.
   */
  const days = useMemo(() => {
    const first = startOfMonth(cursor);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      return day;
    });
  }, [cursor]);

  // Busca apenas os shows do intervalo visível, não a agenda inteira.
  useEffect(() => {
    let active = true;
    setLoading(true);
    const from = toDateOnly(days[0]);
    const to = toDateOnly(days[days.length - 1]);

    (async () => {
      const { data, error } = await supabase
        .from("shows")
        .select("*, clients(id, name)")
        .gte("event_date", from)
        .lte("event_date", to)
        .order("event_date");

      if (!active) return;
      if (error) setError(error.message);
      else {
        setError(null);
        setShows((data as ShowWithClient[]) ?? []);
      }
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [days]);

  /**
   * Shows agrupados por data (AAAA-MM-DD).
   *
   * Cancelados ficam de fora: o calendário mostra ocupação de agenda, e uma
   * data cujo único show foi cancelado está livre de novo. Deixá-los aqui
   * criava uma célula que exibia um show mas se comportava como livre ao
   * clicar. Eles continuam visíveis no Dashboard.
   */
  const byDate = useMemo(() => {
    const map = new Map<string, ShowWithClient[]>();
    for (const show of shows) {
      if (!show.event_date || show.status === "cancelado") continue;
      const list = map.get(show.event_date);
      if (list) list.push(show);
      else map.set(show.event_date, [show]);
    }
    return map;
  }, [shows]);

  /** Status que define a cor do dia, ou null se a data está livre. */
  function statusOf(iso: string): ShowStatus | null {
    const list = byDate.get(iso);
    if (!list) return null;
    return (
      CALENDAR_STATUS_PRIORITY.find((status) =>
        list.some((show) => show.status === status)
      ) ?? null
    );
  }

  function handleDayClick(day: Date) {
    const iso = toDateOnly(day);
    if (statusOf(iso)) setSelectedDay(iso);
    else navigate(`/shows/novo?data=${iso}`);
  }

  const todayIso = toDateOnly(new Date());
  const selectedShows = selectedDay ? (byDate.get(selectedDay) ?? []) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <CalendarDays className="h-6 w-6 text-primary" />
            Calendário
          </h1>
          <p className="text-sm text-muted-foreground">
            Clique numa data livre para agendar um show nela.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            aria-label="Mês anterior"
            onClick={() =>
              setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))
            }
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {/* first-letter (e não capitalize) para não virar "Agosto De 2026". */}
          <span className="inline-block min-w-44 text-center font-semibold first-letter:uppercase">
            {MONTH_FORMAT.format(cursor)}
          </span>
          <Button
            size="icon"
            variant="outline"
            aria-label="Próximo mês"
            onClick={() =>
              setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))
            }
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => setCursor(startOfMonth(new Date()))}
          >
            Hoje
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Erro ao carregar a agenda: {error}
        </Card>
      )}

      <Card className="overflow-hidden p-2 sm:p-4">
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {WEEKDAYS.map((label) => (
            <div
              key={label}
              className="pb-1 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {label}
            </div>
          ))}

          {days.map((day) => {
            const iso = toDateOnly(day);
            const status = statusOf(iso);
            const style = status ? STATUS_STYLES[status] : null;
            const isCurrentMonth = day.getMonth() === cursor.getMonth();
            const list = byDate.get(iso) ?? [];

            return (
              <button
                key={iso}
                type="button"
                onClick={() => handleDayClick(day)}
                aria-label={
                  status
                    ? `${iso}: ${list.length} show(s)`
                    : `${iso}: livre, agendar show`
                }
                className={cn(
                  "group flex min-h-20 flex-col rounded-md border p-1.5 text-left transition-colors sm:min-h-24 sm:p-2",
                  style
                    ? style.cell
                    : "border-border bg-background hover:bg-accent",
                  !isCurrentMonth && "opacity-40",
                  iso === todayIso && "ring-2 ring-ring ring-offset-1 ring-offset-background"
                )}
              >
                <span className="text-xs font-semibold">{day.getDate()}</span>

                {list.length > 0 ? (
                  <span className="mt-1 space-y-0.5 overflow-hidden">
                    {list.slice(0, 2).map((show) => (
                      <span
                        key={show.id}
                        className="block truncate text-[11px] leading-tight"
                      >
                        {show.artist_name}
                      </span>
                    ))}
                    {list.length > 2 && (
                      <span className="block text-[11px] opacity-70">
                        +{list.length - 2}
                      </span>
                    )}
                  </span>
                ) : (
                  <Plus className="mt-auto h-3.5 w-3.5 self-end opacity-0 transition-opacity group-hover:opacity-60" />
                )}
              </button>
            );
          })}
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        {loading && <span>Carregando agenda…</span>}
        {CALENDAR_STATUS_PRIORITY.map((status) => (
          <span key={status} className="flex items-center gap-1.5">
            <span
              className={cn("h-3 w-3 rounded-sm border", STATUS_STYLES[status].cell)}
            />
            {STATUS_STYLES[status].label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm border border-border bg-background" />
          Livre
        </span>
      </div>

      <Dialog
        open={selectedDay !== null}
        onOpenChange={(open) => !open && setSelectedDay(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedDay && formatDate(selectedDay)}</DialogTitle>
            <DialogDescription>
              {selectedShows.length} show(s) nesta data.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {selectedShows.map((show) => {
              const style = STATUS_STYLES[show.status];
              return (
                <button
                  key={show.id}
                  onClick={() => navigate(`/shows/${show.id}/editar`)}
                  className="flex w-full items-start justify-between gap-3 rounded-md border p-3 text-left transition-colors hover:bg-accent"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{show.artist_name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {show.clients?.name ?? "Sem cliente"}
                      {show.location ? ` · ${show.location}` : ""}
                    </p>
                    <span
                      className={cn(
                        "mt-1.5 inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
                        style.badge
                      )}
                    >
                      {style.label}
                    </span>
                  </div>
                  <p className="shrink-0 font-semibold">
                    {formatCurrency(show.value_cents)}
                  </p>
                </button>
              );
            })}
          </div>

          <Button
            variant="outline"
            onClick={() => navigate(`/shows/novo?data=${selectedDay}`)}
          >
            <Plus className="h-4 w-4" />
            Agendar outro show nesta data
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
