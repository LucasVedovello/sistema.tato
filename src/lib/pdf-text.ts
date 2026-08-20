/**
 * Saneamento de texto para as fontes padrão do jsPDF.
 *
 * Helvetica/Times usam a tabela WinAnsi e descartam SILENCIOSAMENTE o que não
 * conseguem representar: um travessão em "CLÁUSULA 1ª — DO OBJETO" simplesmente
 * sumia, deixando um buraco no PDF. Acentos latinos (á, ç, ã, º, ª) passam sem
 * problema e ficam como estão.
 */

// Os dois espaços especiais entram por código: escritos literalmente o ESLint
// os barra (no-irregular-whitespace) e ninguém os enxerga no diff.
const NBSP = String.fromCharCode(0x00a0);
/** Espaço estreito não-quebrável — o Intl usa em "R$ 1.000,00". */
const NARROW_NBSP = String.fromCharCode(0x202f);

const UNSUPPORTED: Record<string, string> = {
  "—": "-", // travessão
  "–": "-", // meia-risca
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
  "…": "...",
  [NBSP]: " ",
  [NARROW_NBSP]: " ",
};

// A classe de caracteres é montada a partir das próprias chaves, para a lista
// não sair de sincronia. Nenhuma delas é especial dentro de [].
const UNSUPPORTED_RE = new RegExp(`[${Object.keys(UNSUPPORTED).join("")}]`, "g");

export function sanitizePdfText(text: string): string {
  return text.replace(UNSUPPORTED_RE, (char) => UNSUPPORTED[char] ?? char);
}
