import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Junta classes do Tailwind resolvendo conflitos (a última vence).
 *
 * Formatação de dados NÃO mora mais aqui: máscara, validação e exibição de
 * documento, telefone, endereço, dinheiro, data e hora estão todas em
 * `@/lib/format`, para o formulário e o contrato usarem a mesma função.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
