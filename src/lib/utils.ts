import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formata centavos (int) para moeda BRL. */
export function formatCurrency(cents: number | null | undefined): string {
  const value = (cents ?? 0) / 100;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/** Converte string de moeda (ex.: "1.500,00" ou "1500") para centavos (int). */
export function parseCurrencyToCents(input: string): number {
  const normalized = input
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

/**
 * Converte "2026-10-03" em Date no fuso LOCAL.
 *
 * `new Date("2026-10-03")` trata a string como UTC meia-noite; ao formatar em
 * pt-BR (UTC-3) isso exibia o dia anterior — um show do dia 03 aparecia como
 * 02. Datas de evento no banco são `date` (sem hora), então têm que ser lidas
 * como data local, não como instante.
 */
export function parseDateOnly(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date(value);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Date -> "AAAA-MM-DD" no fuso local. Contraparte de parseDateOnly. */
export function toDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Formata uma data ISO para o padrão pt-BR (dd/mm/aaaa). */
export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parseDateOnly(date));
}
