/**
 * =============================================================================
 * CAMADA ÚNICA DE FORMATAÇÃO
 * =============================================================================
 *
 * Tudo o que dá forma a um dado — máscara enquanto se digita, validação antes
 * de salvar e formatação na hora de exibir ou imprimir — mora aqui.
 *
 * A razão é uma só: o contrato e a tela precisam mostrar EXATAMENTE o mesmo
 * texto. Quando cada formulário tinha o seu jeito de escrever telefone,
 * documento e endereço, o documento saía com o que tivesse sido digitado, e a
 * padronização virava correção manual.
 *
 * Convenção dos nomes:
 *   mask*    — usada a cada tecla, no `onChange` do campo. Nunca rejeita o que
 *              foi digitado: só recorta o que não é dígito e vai montando a
 *              pontuação. Um valor incompleto continua editável.
 *   *Valido  — validação de verdade (dígitos verificadores, tamanho, faixa),
 *              usada para bloquear o envio do formulário.
 *   format*  — saída pronta para leitura: tela, planilha e contrato.
 */

/** Só os dígitos de um texto qualquer. */
export const somenteDigitos = (valor: string): string =>
  valor.replace(/\D/g, "");

/** Tira espaços das pontas e reduz os repetidos do meio a um só. */
export const normalizarTexto = (valor: string): string =>
  valor.trim().replace(/\s+/g, " ");

/**
 * Palavras que ficam em minúsculo no meio de um nome próprio.
 * A primeira palavra é sempre capitalizada, mesmo estando nesta lista.
 */
const MINUSCULAS = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "em",
  "na",
  "no",
  "nas",
  "nos",
  "a",
  "o",
  "as",
  "os",
]);

/**
 * Capitalização de nome próprio: "andré bueno" e "ANDRÉ BUENO" viram
 * "André Bueno".
 *
 * Só age quando o texto está TODO em maiúsculas ou TODO em minúsculas — que é
 * quando a caixa foi acidente de digitação. Texto com caixa mista já foi
 * escrito de propósito, e mexer nele estragaria "CV Produções", "LTDA",
 * "McDonald's" ou um nome artístico com grafia própria.
 */
export function titleCase(valor: string): string {
  const texto = normalizarTexto(valor);
  if (!texto) return "";

  const temMinuscula = texto !== texto.toUpperCase();
  const temMaiuscula = texto !== texto.toLowerCase();
  if (temMinuscula && temMaiuscula) return texto;

  return texto
    .toLocaleLowerCase("pt-BR")
    .split(" ")
    .map((palavra, indice) => {
      if (indice > 0 && MINUSCULAS.has(palavra)) return palavra;
      // Capitaliza também depois de hífen e apóstrofo ("Sant'Ana", "Bem-Te-Vi").
      return palavra.replace(/(^|[-'])([\p{L}])/gu, (_, antes, letra) =>
        antes + letra.toLocaleUpperCase("pt-BR")
      );
    })
    .join(" ");
}

/* ==========================================================================
 * DOCUMENTOS
 * ======================================================================= */

/** CPF: 000.000.000-00 */
export function maskCPF(valor: string): string {
  const d = somenteDigitos(valor).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

/** CNPJ: 00.000.000/0000-00 */
export function maskCNPJ(valor: string): string {
  const d = somenteDigitos(valor).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

/**
 * CPF ou CNPJ no mesmo campo: até 11 dígitos vira CPF; a partir do 12º, CNPJ.
 * O cadastro tem uma coluna só (`document`) porque o contratante tanto pode
 * ser pessoa física quanto empresa.
 */
export function maskDocumento(valor: string): string {
  const d = somenteDigitos(valor);
  return d.length <= 11 ? maskCPF(valor) : maskCNPJ(valor);
}

const digitoVerificador = (base: string, pesoInicial: number): number => {
  let soma = 0;
  let peso = pesoInicial;
  for (const char of base) {
    soma += Number(char) * peso;
    peso -= 1;
    if (peso < 2) peso = 9;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
};

/** CPF com os dois dígitos verificadores corretos. */
export function cpfValido(valor: string): boolean {
  const d = somenteDigitos(valor);
  if (d.length !== 11) return false;
  // 111.111.111-11 e companhia passam na conta dos dígitos, mas não existem.
  if (/^(\d)\1{10}$/.test(d)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += Number(d[i]) * (10 - i);
  let resto = (soma * 10) % 11 % 10;
  if (resto !== Number(d[9])) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += Number(d[i]) * (11 - i);
  resto = (soma * 10) % 11 % 10;
  return resto === Number(d[10]);
}

/** CNPJ com os dois dígitos verificadores corretos. */
export function cnpjValido(valor: string): boolean {
  const d = somenteDigitos(valor);
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;

  const primeiro = digitoVerificador(d.slice(0, 12), 5);
  if (primeiro !== Number(d[12])) return false;
  const segundo = digitoVerificador(d.slice(0, 13), 6);
  return segundo === Number(d[13]);
}

/** Aceita CPF (11 dígitos) ou CNPJ (14), conforme o que foi digitado. */
export function documentoValido(valor: string): boolean {
  const d = somenteDigitos(valor);
  if (d.length === 11) return cpfValido(d);
  if (d.length === 14) return cnpjValido(d);
  return false;
}

/** Documento já gravado, formatado para leitura. Inválido sai como veio. */
export function formatDocumento(valor: string | null | undefined): string {
  if (!valor) return "";
  const d = somenteDigitos(valor);
  if (d.length === 11) return maskCPF(d);
  if (d.length === 14) return maskCNPJ(d);
  return valor;
}

export const formatCPF = (valor: string | null | undefined): string =>
  valor ? maskCPF(valor) : "";

export const formatCNPJ = (valor: string | null | undefined): string =>
  valor ? maskCNPJ(valor) : "";

/* ==========================================================================
 * TELEFONE E CEP
 * ======================================================================= */

/** (00) 00000-0000 — e (00) 0000-0000 quando o número é fixo. */
export function maskTelefone(valor: string): string {
  const d = somenteDigitos(valor).slice(0, 11);
  if (d.length <= 2) return d.replace(/^(\d{0,2})/, "($1");
  if (d.length <= 6) return d.replace(/^(\d{2})(\d+)/, "($1) $2");
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
  return d.replace(/^(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
}

/** Fixo (10 dígitos) ou celular (11). */
export const telefoneValido = (valor: string): boolean =>
  [10, 11].includes(somenteDigitos(valor).length);

export const formatTelefone = (valor: string | null | undefined): string =>
  valor ? maskTelefone(valor) : "";

/** 00000-000 */
export function maskCEP(valor: string): string {
  const d = somenteDigitos(valor).slice(0, 8);
  return d.replace(/^(\d{5})(\d)/, "$1-$2");
}

export const cepValido = (valor: string): boolean =>
  somenteDigitos(valor).length === 8;

export const formatCEP = (valor: string | null | undefined): string =>
  valor ? maskCEP(valor) : "";

/* ==========================================================================
 * DINHEIRO
 * ======================================================================= */

const MOEDA_BR = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Máscara do campo de valor: o que se digita são centavos, e a pontuação é
 * montada da direita para a esquerda ("123456" -> "1.234,56").
 *
 * Sem o "R$": ele fica fixo na frente do campo, para o cursor nunca cair antes
 * do símbolo.
 */
export function maskMoeda(valor: string): string {
  const d = somenteDigitos(valor).slice(0, 13);
  if (!d) return "";
  return MOEDA_BR.format(Number(d) / 100);
}

/** Texto do campo mascarado -> centavos (inteiro). */
export const moedaParaCentavos = (valor: string): number =>
  Number(somenteDigitos(valor) || 0);

/** Centavos -> texto do campo mascarado ("1.234,56"). */
export const centavosParaMoeda = (cents: number | null | undefined): string =>
  cents == null ? "" : MOEDA_BR.format(cents / 100);

/** Centavos -> "R$ 1.234,56". É o formato do contrato e das listagens. */
export function formatMoeda(cents: number | null | undefined): string {
  const valor = (cents ?? 0) / 100;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

/* ==========================================================================
 * DATA E HORA
 * ======================================================================= */

/**
 * Converte "2026-10-03" em Date no fuso LOCAL.
 *
 * `new Date("2026-10-03")` trata a string como UTC meia-noite; ao formatar em
 * pt-BR (UTC-3) isso exibia o dia anterior — um show do dia 03 aparecia como
 * 02. Datas de evento no banco são `date` (sem hora), então têm que ser lidas
 * como data local, não como instante.
 */
export function parseDateOnly(valor: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!match) return new Date(valor);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Date -> "AAAA-MM-DD" no fuso local. Contraparte de parseDateOnly. */
export function toDateOnly(date: Date): string {
  const ano = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const dia = String(date.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/** "AAAA-MM-DD" -> "DD/MM/AAAA". Vazio vira "—". */
export function formatData(valor: string | null | undefined): string {
  if (!valor) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parseDateOnly(valor));
}

/** A data existe no calendário? ("2026-02-31" não existe.) */
export function dataValida(valor: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!match) return false;
  const [ano, mes, dia] = [+match[1], +match[2], +match[3]];
  const d = new Date(ano, mes - 1, dia);
  return (
    d.getFullYear() === ano && d.getMonth() === mes - 1 && d.getDate() === dia
  );
}

/**
 * Horário do banco ("20:30:00", coluna `time`) para exibição: "20:30".
 *
 * Devolve string VAZIA quando não há horário — diferente de `formatData`, que
 * devolve "—". O horário é opcional e aparece ao lado de outros dados
 * (data, local); um travessão solto ali só polui a linha.
 */
export function formatHora(valor: string | null | undefined): string {
  if (!valor) return "";
  const match = /^(\d{2}):(\d{2})/.exec(valor);
  return match ? `${match[1]}:${match[2]}` : valor;
}

/** "HH:MM" em 24 horas. */
export function horaValida(valor: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(formatHora(valor));
  if (!match) return false;
  return Number(match[1]) <= 23 && Number(match[2]) <= 59;
}

/* ==========================================================================
 * ENDEREÇO
 * ======================================================================= */

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
] as const;

export type UF = (typeof UFS)[number];

/** Endereço em partes, como fica gravado no cadastro. */
export interface Endereco {
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
}

/**
 * Monta o endereço numa linha só, sempre no mesmo formato:
 *
 *   "Rua Nossa Senhora Auxiliadora, nº 235, Sala 2, Centro, Paulínia/SP,
 *    CEP 13140-000"
 *
 * Cada pedaço ausente simplesmente não entra — nada de vírgula solta ou espaço
 * duplo, que é o que acontecia quando o endereço era um campo de texto livre.
 * O ponto final NÃO faz parte do endereço: quem o encerra é a frase que o
 * recebe (a qualificação das partes, no contrato).
 */
export function formatEndereco(endereco: Endereco): string {
  const limpo = (valor?: string | null) => normalizarTexto(valor ?? "");

  const logradouro = limpo(endereco.logradouro);
  const numero = limpo(endereco.numero);
  const cidade = limpo(endereco.cidade);
  const uf = limpo(endereco.uf).toUpperCase();
  const cep = somenteDigitos(endereco.cep ?? "");

  const partes = [
    // "nº" só faz sentido junto do logradouro.
    logradouro && numero ? `${logradouro}, nº ${numero}` : logradouro,
    limpo(endereco.complemento),
    limpo(endereco.bairro),
    cidade && uf ? `${cidade}/${uf}` : cidade || uf,
    cep ? `CEP ${maskCEP(cep)}` : "",
  ];

  return partes.filter(Boolean).join(", ");
}
