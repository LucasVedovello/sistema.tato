/**
 * Valor em reais por extenso.
 *
 * Os contratos-modelo trazem "R$:XXXX (VALOR ESCRITO EM reais)" — o valor
 * numérico e, entre parênteses, o mesmo valor escrito. Como o overlay reescreve
 * o parágrafo inteiro, o texto por extenso precisa sair daqui.
 *
 * Cobre até centenas de milhões, que é o teto útil para um cachê.
 */

const UNIDADES = [
  "",
  "um",
  "dois",
  "três",
  "quatro",
  "cinco",
  "seis",
  "sete",
  "oito",
  "nove",
  "dez",
  "onze",
  "doze",
  "treze",
  "quatorze",
  "quinze",
  "dezesseis",
  "dezessete",
  "dezoito",
  "dezenove",
];

const DEZENAS = [
  "",
  "",
  "vinte",
  "trinta",
  "quarenta",
  "cinquenta",
  "sessenta",
  "setenta",
  "oitenta",
  "noventa",
];

const CENTENAS = [
  "",
  "cento",
  "duzentos",
  "trezentos",
  "quatrocentos",
  "quinhentos",
  "seiscentos",
  "setecentos",
  "oitocentos",
  "novecentos",
];

/** Escreve um grupo de 1 a 999. */
function grupo(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";

  const partes: string[] = [];
  const c = Math.floor(n / 100);
  const resto = n % 100;

  if (c > 0) partes.push(CENTENAS[c]);

  if (resto > 0) {
    if (resto < 20) {
      partes.push(UNIDADES[resto]);
    } else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      partes.push(u > 0 ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d]);
    }
  }

  return partes.join(" e ");
}

/** Parte inteira por extenso, sem o nome da moeda. */
function inteiroPorExtenso(n: number): string {
  if (n === 0) return "zero";

  const milhoes = Math.floor(n / 1_000_000);
  const milhares = Math.floor((n % 1_000_000) / 1000);
  const unidades = n % 1000;

  const partes: string[] = [];
  if (milhoes > 0) {
    partes.push(`${grupo(milhoes)} ${milhoes === 1 ? "milhão" : "milhões"}`);
  }
  if (milhares > 0) {
    // "mil" não leva "um" na frente: 1.500 é "mil e quinhentos".
    partes.push(milhares === 1 ? "mil" : `${grupo(milhares)} mil`);
  }
  if (unidades > 0) partes.push(grupo(unidades));

  // A conjunção antes do último grupo é "e" quando ele é menor que 100 ou
  // múltiplo de 100 (mil e quinhentos, um milhão e duzentos); senão, vírgula.
  if (partes.length === 1) return partes[0];
  const ultimo = partes.pop()!;
  const ligacao =
    unidades > 0 && (unidades < 100 || unidades % 100 === 0) ? " e " : ", ";
  return `${partes.join(", ")}${ligacao}${ultimo}`;
}

/**
 * Centavos (int) -> "mil e quinhentos reais" / "dois mil reais e cinquenta
 * centavos". Sem "R$": o modelo já traz o símbolo antes do número.
 */
export function currencyToWords(cents: number | null | undefined): string {
  const total = Math.max(0, Math.round(cents ?? 0));
  const reais = Math.floor(total / 100);
  const centavos = total % 100;

  const partes: string[] = [];
  if (reais > 0 || centavos === 0) {
    partes.push(`${inteiroPorExtenso(reais)} ${reais === 1 ? "real" : "reais"}`);
  }
  if (centavos > 0) {
    partes.push(
      `${inteiroPorExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`
    );
  }
  return partes.join(" e ");
}
