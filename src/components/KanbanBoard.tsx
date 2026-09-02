import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, Clock, GripVertical, MapPin } from "lucide-react";

import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { STATUS_STYLES } from "@/lib/status";
import { useIsMobile } from "@/lib/use-media-query";
import { cn, formatCurrency, formatDate, formatTime } from "@/lib/utils";
import {
  SHOW_STATUSES,
  SHOW_STATUS_LABELS,
  type ShowStatus,
  type ShowWithClient,
} from "@/types/database";

/** Conteúdo visual do card. Compartilhado entre a coluna e o DragOverlay. */
function ShowCardBody({ show }: { show: ShowWithClient }) {
  const hora = formatTime(show.event_time);

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold leading-tight">{show.artist_name}</p>
        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
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
        {/* Horário logo abaixo da data: é a informação que decide o resto do
            dia de quem produz o show. */}
        {hora && (
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {hora}
          </div>
        )}
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
    </>
  );
}

/**
 * Card na versão do celular: sem arrasto (só uma coluna fica visível por vez),
 * com um seletor para mover o show de status.
 */
function TouchShowCard({
  show,
  onOpen,
  onMove,
}: {
  show: ShowWithClient;
  onOpen: (id: string) => void;
  onMove: (show: ShowWithClient, status: ShowStatus) => void;
}) {
  return (
    <Card
      data-testid={`card-${show.id}`}
      className={cn("p-4", STATUS_STYLES[show.status].column)}
    >
      {/* Só o corpo abre a ficha; o seletor abaixo fica de fora do clique. */}
      <button
        type="button"
        className="w-full text-left"
        onClick={() => onOpen(show.id)}
      >
        <ShowCardBody show={show} />
      </button>

      <div className="mt-3 border-t pt-3">
        <label
          className="mb-1 block text-xs text-muted-foreground"
          htmlFor={`mover-${show.id}`}
        >
          Mover para
        </label>
        <Select
          value={show.status}
          onValueChange={(valor) => onMove(show, valor as ShowStatus)}
        >
          <SelectTrigger id={`mover-${show.id}`} className="bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SHOW_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {SHOW_STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </Card>
  );
}

function DraggableShowCard({
  show,
  onOpen,
}: {
  show: ShowWithClient;
  onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: show.id });

  return (
    <Card
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...listeners}
      {...attributes}
      onClick={() => onOpen(show.id)}
      data-testid={`card-${show.id}`}
      className={cn(
        "group cursor-grab touch-none p-4 transition-shadow hover:shadow-md active:cursor-grabbing",
        STATUS_STYLES[show.status].column,
        // O card original some enquanto o DragOverlay o representa.
        isDragging && "opacity-40"
      )}
    >
      <ShowCardBody show={show} />
    </Card>
  );
}

function KanbanColumn({
  status,
  shows,
  onOpen,
}: {
  status: ShowStatus;
  shows: ShowWithClient[];
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const style = STATUS_STYLES[status];
  const total = shows.reduce((sum, s) => sum + (s.value_cents ?? 0), 0);

  return (
    <div className="flex flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("h-2.5 w-2.5 rounded-full", style.dot)} />
          <h2 className="text-sm font-semibold">{style.label}</h2>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {shows.length}
        </span>
      </div>

      <p className="mb-2 text-xs text-muted-foreground">
        {formatCurrency(total)}
      </p>

      {/* min-h garante área de soltura mesmo com a coluna vazia. */}
      <div
        ref={setNodeRef}
        data-testid={`coluna-${status}`}
        className={cn(
          "flex min-h-40 flex-col gap-3 rounded-lg border-2 border-dashed p-2 transition-colors",
          isOver
            ? "border-primary bg-primary/5"
            : "border-transparent bg-muted/30 dark:bg-muted/10"
        )}
      >
        {shows.length === 0 && (
          <p className="p-4 text-center text-xs text-muted-foreground">
            {isOver ? "Solte aqui" : "Nenhum show"}
          </p>
        )}
        {shows.map((show) => (
          <DraggableShowCard key={show.id} show={show} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

/**
 * Quadro Kanban dos shows. Arrastar um card entre colunas grava o novo status
 * no banco.
 */
export function KanbanBoard({ onOpenShow }: { onOpenShow: (id: string) => void }) {
  const [shows, setShows] = useState<ShowWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  /** Aba visível no celular — no desktop as quatro colunas aparecem juntas. */
  const [abaAtiva, setAbaAtiva] = useState<ShowStatus>("criado");
  const isMobile = useIsMobile();

  const sensors = useSensors(
    // Sem a distância mínima, um clique simples viraria arrasto e o card
    // nunca abriria a ficha.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("shows")
        .select("*, clients(id, name)")
        .order("event_date", { ascending: true, nullsFirst: false });

      if (!active) return;
      if (error) setError(error.message);
      else setShows((data as ShowWithClient[]) ?? []);
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

  const activeShow = activeId
    ? (shows.find((s) => s.id === activeId) ?? null)
    : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  /**
   * Move o show de status. Serve ao arrasto (desktop) e ao seletor do card
   * (celular) — a regra de otimismo e desfazer é a mesma nos dois.
   */
  async function moverShow(show: ShowWithClient, novoStatus: ShowStatus) {
    if (show.status === novoStatus) return;
    const anterior = show.status;
    // Move na hora e desfaz se o banco recusar — arrastar tem que parecer
    // instantâneo.
    setShows((prev) =>
      prev.map((s) => (s.id === show.id ? { ...s, status: novoStatus } : s))
    );
    setError(null);

    const { error } = await supabase
      .from("shows")
      .update({ status: novoStatus })
      .eq("id", show.id);

    if (error) {
      setShows((prev) =>
        prev.map((s) => (s.id === show.id ? { ...s, status: anterior } : s))
      );
      setError(`Não foi possível mover "${show.artist_name}": ${error.message}`);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    // Só as colunas são áreas de soltura, então o id é sempre um status.
    const show = shows.find((s) => s.id === active.id);
    if (show) void moverShow(show, over.id as ShowStatus);
  }

  if (loading) return <p className="text-muted-foreground">Carregando shows…</p>;

  return (
    <div className="space-y-4">
      {error && (
        <Card className="border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </Card>
      )}

      {isMobile ? (
        /*
         * Celular: uma coluna por vez, escolhida nas abas. Quatro colunas lado
         * a lado não cabem em 375px, e empilhá-las daria uma página que só
         * termina na rolagem. Sem arrasto aqui — só uma coluna está visível,
         * então o card traz um seletor de status.
         */
        <div data-testid="kanban">
          <div
            className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1"
            role="tablist"
            aria-label="Status dos shows"
          >
            {SHOW_STATUSES.map((status) => {
              const ativa = status === abaAtiva;
              const style = STATUS_STYLES[status];
              return (
                <button
                  key={status}
                  type="button"
                  role="tab"
                  aria-selected={ativa}
                  onClick={() => setAbaAtiva(status)}
                  className={cn(
                    "flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors",
                    ativa
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground"
                  )}
                >
                  <span className={cn("h-2.5 w-2.5 rounded-full", style.dot)} />
                  {style.label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-xs",
                      ativa ? "bg-primary-foreground/20" : "bg-muted"
                    )}
                  >
                    {grouped[status].length}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="mb-3 text-sm text-muted-foreground">
            {grouped[abaAtiva].length} show(s) ·{" "}
            {formatCurrency(
              grouped[abaAtiva].reduce((soma, s) => soma + (s.value_cents ?? 0), 0)
            )}
          </p>

          <div
            className="flex flex-col gap-3"
            data-testid={`coluna-${abaAtiva}`}
            role="tabpanel"
          >
            {grouped[abaAtiva].length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhum show com este status.
              </p>
            ) : (
              grouped[abaAtiva].map((show) => (
                <TouchShowCard
                  key={show.id}
                  show={show}
                  onOpen={onOpenShow}
                  onMove={(s, status) => void moverShow(s, status)}
                />
              ))
            )}
          </div>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <div
            className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
            data-testid="kanban"
          >
            {SHOW_STATUSES.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                shows={grouped[status]}
                onOpen={onOpenShow}
              />
            ))}
          </div>

          {/* Card "flutuante" que acompanha o cursor durante o arrasto. */}
          <DragOverlay>
            {activeShow && (
              <Card
                className={cn(
                  "group cursor-grabbing p-4 shadow-xl",
                  STATUS_STYLES[activeShow.status].column
                )}
              >
                <ShowCardBody show={activeShow} />
              </Card>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
