import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { ShowWithClient } from "@/types/database";

export function ClosedShows() {
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
        .eq("status", "fechado")
        .order("event_date", { ascending: false, nullsFirst: false });

      if (!active) return;
      if (error) setError(error.message);
      else setShows((data as ShowWithClient[]) ?? []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const total = useMemo(
    () => shows.reduce((sum, s) => sum + (s.value_cents ?? 0), 0),
    [shows]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            Shows fechados
          </h1>
          <p className="text-sm text-muted-foreground">
            {shows.length} show(s) · Total {formatCurrency(total)}
          </p>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Erro ao carregar: {error}
        </Card>
      )}

      {loading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : shows.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          Nenhum show fechado ainda.
        </Card>
      ) : (
        <Card className="divide-y">
          {shows.map((show) => (
            <button
              key={show.id}
              onClick={() => navigate(`/shows/${show.id}/editar`)}
              className="flex w-full items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-accent/50"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">{show.artist_name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {show.clients?.name ? `${show.clients.name} · ` : ""}
                  {show.location ?? "Local não informado"}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold">
                  {formatCurrency(show.value_cents)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(show.event_date)}
                </p>
              </div>
            </button>
          ))}
        </Card>
      )}
    </div>
  );
}
