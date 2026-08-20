import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  FileSignature,
  MessageSquare,
  PenLine,
  Plus,
  Send,
  Sparkles,
  StickyNote,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { STATUS_STYLES } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { ActivityKind, ShowActivity } from "@/types/database";

const DATA_HORA = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const ICONES: Record<ActivityKind, typeof StickyNote> = {
  created: Sparkles,
  status: ArrowRight,
  note: StickyNote,
  message: MessageSquare,
  contract: FileSignature,
  signature: PenLine,
};

/** Cor do marcador de cada tipo de evento. */
const CORES: Record<ActivityKind, string> = {
  created: "bg-muted text-muted-foreground",
  status: "bg-primary/10 text-primary",
  note: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  message: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  contract:
    "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  signature:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};

function StatusPill({ status }: { status: keyof typeof STATUS_STYLES }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
        style.badge
      )}
    >
      {style.label}
    </span>
  );
}

function ActivityRow({ activity }: { activity: ShowActivity }) {
  const Icone = ICONES[activity.kind];
  /**
   * Mudança de status sem autor foi feita pela automação do contrato — quem
   * clica sempre fica registrado. O motivo vem no `content`.
   */
  const automatico = activity.kind === "status" && !activity.author_email;

  return (
    <li className="group relative flex gap-3 pb-5 last:pb-0">
      {/* Linha vertical ligando os eventos. `group-last` (e não `last`) porque
          quem precisa ser o último é o <li>, não este <span>. */}
      <span
        aria-hidden
        className="absolute left-4 top-9 h-[calc(100%-2.25rem)] w-px -translate-x-1/2 bg-muted-foreground/25 group-last:hidden"
      />
      <span
        className={cn(
          "z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          CORES[activity.kind]
        )}
      >
        <Icone className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {activity.kind === "created" && (
            <>
              <span className="font-medium">Show criado</span>
              {activity.to_status && <StatusPill status={activity.to_status} />}
            </>
          )}

          {activity.kind === "status" && (
            <>
              <span className="font-medium">
                {automatico ? "Status alterado automaticamente" : "Status alterado"}
              </span>
              {activity.from_status && (
                <StatusPill status={activity.from_status} />
              )}
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              {activity.to_status && <StatusPill status={activity.to_status} />}
              {automatico && (
                <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  automático
                </span>
              )}
            </>
          )}

          {activity.kind === "note" && (
            <span className="font-medium">Nota</span>
          )}
          {activity.kind === "message" && (
            <span className="font-medium">Mensagem enviada</span>
          )}
          {activity.kind === "contract" && (
            <span className="font-medium">Contrato gerado</span>
          )}
          {activity.kind === "signature" && (
            <span className="font-medium">Assinatura</span>
          )}
        </div>

        {activity.content && (
          <p className="whitespace-pre-line break-words text-sm text-muted-foreground">
            {activity.content}
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          {DATA_HORA.format(new Date(activity.created_at))}
          {activity.author_email ? ` · ${activity.author_email}` : ""}
        </p>
      </div>
    </li>
  );
}

/**
 * Timeline de atividades do show.
 *
 * Criação e mudanças de status são gravadas por gatilho no banco (valem para
 * qualquer caminho, inclusive o arrasto no Kanban); aqui só se escrevem notas.
 */
export function ShowTimeline({ showId }: { showId: string }) {
  const [activities, setActivities] = useState<ShowActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("show_activities")
      .select("*")
      .eq("show_id", showId)
      .order("created_at", { ascending: false });

    if (error) setError(error.message);
    else {
      setError(null);
      setActivities((data as ShowActivity[]) ?? []);
    }
    setLoading(false);
  }, [showId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAddNote(e: FormEvent) {
    e.preventDefault();
    const conteudo = note.trim();
    if (!conteudo) return;

    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("show_activities").insert({
      show_id: showId,
      kind: "note",
      content: conteudo,
      author_email: userData.user?.email ?? null,
    });
    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }
    setNote("");
    void load();
  }

  return (
    <Card data-testid="timeline">
      <CardHeader>
        <CardTitle className="text-base">Timeline</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleAddNote} className="space-y-2">
          <Textarea
            id="nova-nota"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Escreva uma nota sobre este show…"
            rows={2}
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={saving || !note.trim()}>
              {saving ? (
                <>
                  <Send className="h-4 w-4" />
                  Salvando…
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Adicionar nota
                </>
              )}
            </Button>
          </div>
        </form>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando timeline…</p>
        ) : activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma atividade ainda.
          </p>
        ) : (
          <ol className="mt-2">
            {activities.map((activity) => (
              <ActivityRow key={activity.id} activity={activity} />
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
