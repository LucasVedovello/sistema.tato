import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, MapPin } from "lucide-react";

import { ExportExcelButton } from "@/components/ExportExcelButton";
import { Card } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { STATUS_STYLES } from "@/lib/status";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  SHOW_STATUSES,
  type ShowStatus,
  type ShowWithClient,
} from "@/types/database";

export function Dashboard() {
  const navigate = useNavigate();
  const [shows, setShows] = useState<ShowWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("shows")
        .select("*, clients(id, name)")
        .order("event_date", { ascending: true, nullsFirst: false });

      if (!active) return;
      if (error) {
        setError(error.message);
      } else {
        setShows((data as ShowWithClient[]) ?? []);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const grouped = useMemo(() => {
    const base: Record<ShowStatus, ShowWithClient[]> = {
      criado: [],
      em_fechamento: [],
      fechado: [],
      cancelado: [],
    };
    for (const show of shows) base[show.status]?.push(show);
    return base;
  }, [shows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Seus shows organizados por status.
          </p>
        </div>
        <ExportExcelButton />
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Erro ao carregar shows: {error}
        </Card>
      )}

      {loading ? (
        <p className="text-muted-foreground">Carregando shows…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {SHOW_STATUSES.map((status) => {
            const style = STATUS_STYLES[status];
            const items = grouped[status];
            return (
              <div key={status} className="flex flex-col">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2.5 w-2.5 rounded-full", style.dot)} />
                    <h2 className="text-sm font-semibold">{style.label}</h2>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {items.length}
                  </span>
                </div>

                <div className="flex flex-col gap-3">
                  {items.length === 0 && (
                    <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                      Nenhum show
                    </p>
                  )}
                  {items.map((show) => (
                    <Card
                      key={show.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/shows/${show.id}/editar`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigate(`/shows/${show.id}/editar`);
                        }
                      }}
                      className={cn(
                        "cursor-pointer p-4 transition-shadow hover:shadow-md",
                        style.column
                      )}
                    >
                      <p className="font-semibold leading-tight">
                        {show.artist_name}
                      </p>
                      {show.clients?.name && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {show.clients.name}
                        </p>
                      )}
                      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatDate(show.event_date)}
                        </div>
                        {show.location && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" />
                            <span className="truncate">{show.location}</span>
                          </div>
                        )}
                      </div>
                      <p className="mt-3 text-sm font-semibold">
                        {formatCurrency(show.value_cents)}
                      </p>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
