import { useEffect, useMemo, useState, type ReactNode } from "react";
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
import { jaRealizado } from "@/lib/shows";
import { supabase } from "@/lib/supabase";
import {
  COLUNAS_ARRASTAVEIS,
  COLUNAS_KANBAN,
  COLUNA_REALIZADOS,
  COLUNA_STYLES,
  STATUS_STYLES,
  type ColunaKanban,
} from "@/lib/status";
import { useIsMobile } from "@/lib/use-media-query";
import { cn, formatCurrency, formatDate, formatTime } from "@/lib/utils";
import {
  SHOW_STATUSES,
  SHOW_STATUS_LABELS,
  type ShowStatus,
  type ShowWithClient,
} from "@/types/database";

/**
 * Conteúdo visual do card. Compartilhado entre a coluna e o DragOverlay.
 *
 * `mostrarStatus` liga o selo de status: na coluna de realizados a posição do
 * card não diz mais em que pé o show ficou, então o selo passa a ser a única
 * pista — nas colunas de status ele seria redundante.
 */
function ShowCardBody({
  show,
  mostrarStatus = false,
  arrastavel = true,
}: {
  show: ShowWithClient;
  mostrarStatus?: boolean;
  /** Desliga a alça de arrasto nos cards que não se arrastam. */
  arrastavel?: boolean;
}) {
  const hora = formatTime(show.event_time);

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold leading-tight">{show.artist_name}</p>
        {arrastavel && (
          <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        )}
      </div>
      {show.clients?.name && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          {show.clients.name}
        </p>
      )}
      {mostrarStatus && (
        <span
          className={cn(
            "mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
            STATUS_STYLES[show.status].badge
          )}
        >
          {STATUS_STYLES[show.status].label}
        </span>
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
        {/* Horário fecha o bloco de data e local, no mesmo padrão de ícone. */}
        {hora && (
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {hora}
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
 *
 * O seletor continua aparecendo na aba de realizados: o status do show já
 * realizado ainda importa (é o que o relatório soma como fechado), e é por ele
 * que se cancela um show a partir do quadro.
 */
function TouchShowCard({
  show,
  coluna,
  onOpen,
  onMove,
}: {
  show: ShowWithClient;
  coluna: ColunaKanban;
  onOpen: (id: string) => void;
  onMove: (show: ShowWithClient, status: ShowStatus) => void;
}) {
  return (
    <Card
      data-testid={`card-${show.id}`}
      className={cn("p-4", COLUNA_STYLES[coluna].column)}
    >
      {/* Só o corpo abre a ficha; o seletor abaixo fica de fora do clique. */}
      <button
        type="button"
        className="w-full text-left"
        onClick={() => onOpen(show.id)}
      >
        <ShowCardBody
          show={show}
          mostrarStatus={coluna === COLUNA_REALIZADOS}
          arrastavel={false}
        />
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

/**
 * Card da coluna de realizados: abre a ficha, mas não arrasta — a coluna vem
 * da data do evento, e arrastar para fora dela não mudaria nada.
 */
function StaticShowCard({
  show,
  onOpen,
}: {
  show: ShowWithClient;
  onOpen: (id: string) => void;
}) {
  return (
    <Card
      onClick={() => onOpen(show.id)}
      data-testid={`card-${show.id}`}
      className={cn(
        "group cursor-pointer p-4 transition-shadow hover:shadow-md",
        COLUNA_STYLES[COLUNA_REALIZADOS].column
      )}
    >
      <ShowCardBody show={show} mostrarStatus arrastavel={false} />
    </Card>
  );
}

/** Coluna de status: aceita soltura e tem cards arrastáveis. */
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

  return (
    <ColumnShell coluna={status} shows={shows}>
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
    </ColumnShell>
  );
}

/**
 * Coluna dos realizados: mesmo desenho das outras, sem soltura nem arrasto.
 * Ocupa a posição que era da coluna de cancelados.
 */
function RealizadosColumn({
  shows,
  onOpen,
}: {
  shows: ShowWithClient[];
  onOpen: (id: string) => void;
}) {
  return (
    <ColumnShell coluna={COLUNA_REALIZADOS} shows={shows}>
      <div
        data-testid={`coluna-${COLUNA_REALIZADOS}`}
        className="flex min-h-40 flex-col gap-3 rounded-lg border-2 border-dashed border-transparent bg-muted/30 p-2 dark:bg-muted/10"
      >
        {shows.length === 0 && (
          <p className="p-4 text-center text-xs text-muted-foreground">
            Nenhum show realizado
          </p>
        )}
        {shows.map((show) => (
          <StaticShowCard key={show.id} show={show} onOpen={onOpen} />
        ))}
      </div>
    </ColumnShell>
  );
}

/** Cabeçalho comum às colunas: cor, título, contagem e soma. */
function ColumnShell({
  coluna,
  shows,
  children,
}: {
  coluna: ColunaKanban;
  shows: ShowWithClient[];
  children: ReactNode;
}) {
  const style = COLUNA_STYLES[coluna];
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

      {children}
    </div>
  );
}

/**
 * Quadro Kanban dos shows. Arrastar um card entre colunas grava o novo status
 * no banco.
 *
 * A quarta coluna não é um status: são os shows cuja data já passou. Um show
 * entra nela sozinho, saindo da coluna do status em que estava, para o quadro
 * mostrar só o que ainda está por acontecer.
 */
export function KanbanBoard({ onOpenShow }: { onOpenShow: (id: string) => void }) {
  const [shows, setShows] = useState<ShowWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  /** Aba visível no celular — no desktop as quatro colunas aparecem juntas. */
  const [abaAtiva, setAbaAtiva] = useState<ColunaKanban>("criado");
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
    const base: Record<ColunaKanban, ShowWithClient[]> = {
      criado: [],
      em_fechamento: [],
      fechado: [],
      cancelado: [],
      [COLUNA_REALIZADOS]: [],
    };
    // `agora` é calculado uma vez por agrupamento para todos os cards
    // responderem ao mesmo instante.
    const agora = new Date();
    for (const show of shows) {
      if (jaRealizado(show, agora)) base[COLUNA_REALIZADOS].push(show);
      else base[show.status]?.push(show);
    }
    // Realizados do mais recente para o mais antigo: o que acabou de acontecer
    // é o que ainda tem pendência (acerto, vídeo, feedback).
    base[COLUNA_REALIZADOS].reverse();
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
    // Só as colunas de status são áreas de soltura; a de realizados não recebe
    // arrasto, então o id que chega aqui é sempre um status.
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
            aria-label="Colunas dos shows"
          >
            {COLUNAS_KANBAN.map((coluna) => {
              const ativa = coluna === abaAtiva;
              const style = COLUNA_STYLES[coluna];
              return (
                <button
                  key={coluna}
                  type="button"
                  role="tab"
                  aria-selected={ativa}
                  onClick={() => setAbaAtiva(coluna)}
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
                    {grouped[coluna].length}
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
                {abaAtiva === COLUNA_REALIZADOS
                  ? "Nenhum show realizado ainda."
                  : "Nenhum show com este status."}
              </p>
            ) : (
              grouped[abaAtiva].map((show) => (
                <TouchShowCard
                  key={show.id}
                  show={show}
                  coluna={abaAtiva}
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
            {COLUNAS_ARRASTAVEIS.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                shows={grouped[status]}
                onOpen={onOpenShow}
              />
            ))}
            <RealizadosColumn
              shows={grouped[COLUNA_REALIZADOS]}
              onOpen={onOpenShow}
            />
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
