import type { ShowStatus } from "@/types/database";

/**
 * Configuração visual de cada status de show.
 * `badge`  -> classes para o rótulo (Badge)
 * `dot`    -> classe de cor do "ponto" no calendário/lista
 * `column` -> classe de destaque para a coluna no dashboard
 *
 * Os tons `*-100` do tema claro ficam ilegíveis no escuro, então cada `badge`
 * traz uma variante `dark:` própria: fundo bem escuro (`*-950`) com texto claro
 * (`*-200`). Os `dot` usam tons 400/500, que têm contraste suficiente nos dois
 * temas e por isso não precisam de variante.
 */
export const STATUS_STYLES: Record<
  ShowStatus,
  { label: string; badge: string; dot: string; column: string; cell: string }
> = {
  criado: {
    label: "Criado",
    badge:
      "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
    dot: "bg-slate-400",
    column: "border-t-4 border-t-slate-400",
    cell: "bg-slate-100 border-slate-300 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-700",
  },
  em_fechamento: {
    label: "Em fechamento",
    badge:
      "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800",
    dot: "bg-amber-500",
    column: "border-t-4 border-t-amber-500",
    cell: "bg-amber-100 border-amber-300 text-amber-900 hover:bg-amber-200 dark:bg-amber-950 dark:border-amber-700 dark:text-amber-100 dark:hover:bg-amber-900",
  },
  fechado: {
    label: "Fechado",
    badge:
      "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800",
    dot: "bg-emerald-500",
    column: "border-t-4 border-t-emerald-500",
    cell: "bg-emerald-100 border-emerald-300 text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-950 dark:border-emerald-700 dark:text-emerald-100 dark:hover:bg-emerald-900",
  },
  cancelado: {
    label: "Cancelado",
    badge:
      "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800",
    dot: "bg-rose-500",
    column: "border-t-4 border-t-rose-500",
    cell: "bg-rose-100 border-rose-300 text-rose-900 hover:bg-rose-200 dark:bg-rose-950 dark:border-rose-700 dark:text-rose-100 dark:hover:bg-rose-900",
  },
};

/**
 * Prioridade de exibição quando um mesmo dia tem mais de um show: o status
 * mais "firme" define a cor da célula do calendário. `cancelado` fica de fora
 * de propósito — um show cancelado não ocupa a data, então o dia continua
 * livre e clicável para agendar.
 */
export const CALENDAR_STATUS_PRIORITY: ShowStatus[] = [
  "fechado",
  "em_fechamento",
  "criado",
];

/**
 * Coluna do Kanban que NÃO é um status: reúne os shows que já aconteceram.
 *
 * Ela ocupa o lugar que era dos cancelados. Um show entra aqui pela data do
 * evento (ver `jaRealizado`), não por alguém arrastar o card — por isso a
 * coluna não recebe soltura e seus cards não são arrastáveis.
 */
export const COLUNA_REALIZADOS = "realizados";

export type ColunaKanban = ShowStatus | typeof COLUNA_REALIZADOS;

/**
 * Colunas do quadro, na ordem em que aparecem.
 *
 * `cancelado` ficou de fora: um show cancelado sai do quadro (continua nos
 * relatórios, na planilha do dashboard e na própria ficha).
 */
export const COLUNAS_KANBAN: ColunaKanban[] = [
  "criado",
  "em_fechamento",
  "fechado",
  COLUNA_REALIZADOS,
];

/** Colunas que aceitam soltura no arrasto — só as que são status de verdade. */
export const COLUNAS_ARRASTAVEIS: ShowStatus[] = [
  "criado",
  "em_fechamento",
  "fechado",
];

/**
 * Estilo de cada coluna. As três primeiras herdam o estilo do status; a de
 * realizados usa violeta, que não se confunde com nenhuma das outras nem
 * carrega o alarme do vermelho — o show aconteceu, não deu errado.
 */
export const COLUNA_STYLES: Record<
  ColunaKanban,
  { label: string; badge: string; dot: string; column: string; cell: string }
> = {
  criado: STATUS_STYLES.criado,
  em_fechamento: STATUS_STYLES.em_fechamento,
  fechado: STATUS_STYLES.fechado,
  cancelado: STATUS_STYLES.cancelado,
  [COLUNA_REALIZADOS]: {
    label: "Realizados",
    badge:
      "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950 dark:text-violet-200 dark:border-violet-800",
    dot: "bg-violet-500",
    column: "border-t-4 border-t-violet-500",
    cell: "bg-violet-100 border-violet-300 text-violet-900 hover:bg-violet-200 dark:bg-violet-950 dark:border-violet-700 dark:text-violet-100 dark:hover:bg-violet-900",
  },
};
