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
  { label: string; badge: string; dot: string; column: string }
> = {
  criado: {
    label: "Criado",
    badge:
      "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
    dot: "bg-slate-400",
    column: "border-t-4 border-t-slate-400",
  },
  em_fechamento: {
    label: "Em fechamento",
    badge:
      "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800",
    dot: "bg-amber-500",
    column: "border-t-4 border-t-amber-500",
  },
  fechado: {
    label: "Fechado",
    badge:
      "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800",
    dot: "bg-emerald-500",
    column: "border-t-4 border-t-emerald-500",
  },
  cancelado: {
    label: "Cancelado",
    badge:
      "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800",
    dot: "bg-rose-500",
    column: "border-t-4 border-t-rose-500",
  },
};
