import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, Clock, MapPin } from "lucide-react";

import { Card } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { STATUS_STYLES } from "@/lib/status";
import { productionSummary } from "@/lib/production";
import {
  cn,
  formatCurrency,
  formatDate,
  formatTime,
  toDateOnly,
} from "@/lib/utils";
import type { ShowWithClient } from "@/types/database";

/**
 * Shows que já aconteceram.
 *
 * O corte é a DATA do evento comparada com hoje, e não o status: um show só
 * entra aqui depois que o dia dele passou (`event_date < hoje`), então um show
 * marcado para hoje continua no quadro até virar o dia — que é exatamente o
 * que "realizado" quer dizer para quem produz.
 *
 * Cancelados ficam de fora: a data passou, mas o show não aconteceu. Eles
 * continuam visíveis no Kanban, na coluna de cancelados.
 */
export function RealizedShows({
  onOpenShow,
}: {
  onOpenShow: (id: string) => void;
}) {
  const [shows, setShows] = useState<ShowWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("shows")
        .select("*, clients(id, name)")
        .lt("event_date", toDateOnly(new Date()))
        .neq("status", "cancelado")
        // Do mais recente para o mais antigo: o que acabou de acontecer é o
        // que ainda tem pendência (acerto, vídeo, feedback).
        .order("event_date", { ascending: false });

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
    () => shows.reduce((soma, show) => soma + (show.value_cents ?? 0), 0),
    [shows]
  );

  if (loading) {
    return <p className="text-muted-foreground">Carregando realizados…</p>;
  }

  return (
    <div className="space-y-4" data-testid="realizados">
      {error && (
        <Card className="border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </Card>
      )}

      <p className="text-sm text-muted-foreground">
        {shows.length} show(s) realizado(s) · {formatCurrency(total)}
      </p>

      {shows.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          Nenhum show com data já passada.
        </Card>
      ) : (
        <Card className="divide-y">
          {shows.map((show) => {
            const style = STATUS_STYLES[show.status];
            const hora = formatTime(show.event_time);
            const producao = productionSummary(show.production_roles);
            return (
              <button
                key={show.id}
                onClick={() => onOpenShow(show.id)}
                data-testid={`realizado-${show.id}`}
                className="flex w-full items-start justify-between gap-4 p-4 text-left transition-colors hover:bg-accent/50"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold">{show.artist_name}</p>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-xs font-medium",
                        style.badge
                      )}
                    >
                      {style.label}
                    </span>
                  </div>

                  {show.clients?.name && (
                    <p className="truncate text-sm text-muted-foreground">
                      {show.clients.name}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <CalendarCheck className="h-3.5 w-3.5" />
                      {formatDate(show.event_date)}
                    </span>
                    {hora && (
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {hora}
                      </span>
                    )}
                    {show.location && (
                      <span className="flex min-w-0 items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{show.location}</span>
                      </span>
                    )}
                  </div>

                  {producao && (
                    <p className="text-xs text-muted-foreground">
                      Produção: {producao}
                    </p>
                  )}
                </div>

                <p className="shrink-0 font-semibold">
                  {formatCurrency(show.value_cents)}
                </p>
              </button>
            );
          })}
        </Card>
      )}
    </div>
  );
}
