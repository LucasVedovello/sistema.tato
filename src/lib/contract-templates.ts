/**
 * Os dois contratos-modelo em PDF que vivem no bucket `contratos`.
 *
 * O PDF é o documento oficial e não é reescrito: o app apenas SOBREPÕE os
 * dados do show sobre os trechos-modelo ("XX/XX/XXXX", "R$:XXXX", "Nome
 * completo:, CPF/CNPJ:...") e as assinaturas sobre as linhas já impressas.
 *
 * Coordenadas
 * -----------
 * Cada caixa é declarada em PONTOS da página original (595,5 x 842,2 — A4 do
 * arquivo enviado) porque é assim que dá para conferir contra o PDF, mas é
 * guardada em RAZÕES (0..1). Assim o mesmo número serve para a pré-visualização
 * em tela (percentuais de CSS) e para o PDF final (multiplicado pelo tamanho
 * real da página), sem depender da resolução de renderização.
 *
 * As posições foram tiradas das coordenadas de texto dos próprios arquivos; os
 * dois modelos têm a mesma diagramação, então quase toda caixa é comum aos dois.
 */

import { currencyToWords } from "@/lib/extenso";
import { formatCurrency, formatDate } from "@/lib/utils";

export type ContractTemplateKey = "carnellos" | "producao";

/** Retângulo em razões da página (x,y = canto superior-esquerdo). */
export type Box = {
  /** 1-based. */
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type OverlayText = {
  box: Box;
  /**
   * Texto do campo. Trechos entre `**` saem em negrito, como no modelo
   * ("**2.1 -**", "**CONTRATANTE:**").
   */
  text: string;
  /**
   * Pinta a caixa de branco antes de escrever. Serve para tapar o texto-modelo
   * ("Nome completo:, CPF/CNPJ:...") que está impresso no PDF original.
   */
  redact?: boolean;
  /** Corpo da fonte em pontos da página original (o modelo usa Arial 11). */
  size?: number;
  /** Distribui os espaços para alinhar as duas margens, como no modelo. */
  justify?: boolean;
};

export type SignatureField = {
  /** Quem assina neste campo. */
  party: "client" | "office";
  box: Box;
};

/**
 * Página do modelo, em pontos.
 *
 * A altura é a do viewBox (850,08 − 7,83): estes PDFs NÃO começam em y = 0.
 * Foi essa origem deslocada que jogou a primeira versão das caixas 8 pt acima
 * do texto — os valores de Y abaixo são a linha de base medida na página
 * renderizada, que é o mesmo sistema de coordenadas do PDF gerado.
 */
const PAGE_W = 595.5;
const PAGE_H = 842.25;

const box = (page: number, x: number, y: number, w: number, h: number): Box => ({
  page,
  x: x / PAGE_W,
  y: y / PAGE_H,
  w: w / PAGE_W,
  h: h / PAGE_H,
});

/**
 * Caixas comuns aos dois modelos (a diagramação é idêntica).
 *
 * As coordenadas Y batem com a linha de base do texto original menos o
 * ascendente da fonte — ou seja, cobrem a linha inteira.
 */
const BOXES = {
  /** Página 1: "CONTRATANTE: Nome completo:, CPF/CNPJ:, Telefone:, Endereço:" */
  contratante: box(1, 70, 175, 466, 27),
  /** Página 1, cláusula 1: as três linhas do objeto. */
  objeto: box(1, 70, 233, 466, 50),
  /** Página 2, cláusula 3: o parágrafo 2.1 inteiro (cinco linhas). */
  remuneracao: box(2, 70, 102, 466, 86),
  /** Página 2, cláusula 4.1: vigência + multa de rescisão. */
  multa: box(2, 70, 306, 466, 71),
  /** Página 2, fim da cláusula 5: "... sucessores. Paulínia, <data>." */
  localData: box(2, 70, 567, 400, 15),
  /** Página 2: rótulo sob a linha de assinatura do contratado. */
  rotuloContratado: box(2, 72, 728, 320, 15),
  /** Página 3: rótulo sob a linha de assinatura do contratante. */
  rotuloContratante: box(3, 72, 175, 320, 15),
};

/**
 * Campos de assinatura: ficam logo ACIMA das linhas já impressas no modelo
 * (contratado na página 2, contratante na página 3).
 */
export const SIGNATURE_FIELDS: SignatureField[] = [
  // As linhas impressas ficam em y ≈ 709 (página 2) e y ≈ 142 (página 3); a
  // assinatura ocupa a faixa logo acima, encostando na linha.
  { party: "office", box: box(2, 76, 663, 224, 44) },
  { party: "client", box: box(3, 79, 95, 224, 44) },
];

export const signatureField = (party: "client" | "office"): SignatureField =>
  SIGNATURE_FIELDS.find((f) => f.party === party)!;

/** Dados do show/cliente que entram no overlay. */
export interface ContractData {
  /** Nome COMPLETO do artista (o da ficha não entra em contrato). */
  artist: string;
  /** Nome COMPLETO do contratante. */
  clientName: string;
  clientDocument: string;
  clientPhone: string;
  clientAddress: string;
  eventName: string;
  /** ISO "AAAA-MM-DD". */
  eventDate: string | null;
  eventTime: string;
  location: string;
  valueCents: number | null;
  paymentTerms: string;
  /** Cidade da assinatura (o modelo traz Paulínia). */
  city: string;
  signedOn: Date;
}

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** "20 de agosto de 2026" — mesmo formato da data já impressa no modelo. */
export const longDate = (d: Date): string =>
  `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;

/** Texto de um campo em branco: fica visível que falta preencher. */
const ou = (valor: string, vazio = "____________") =>
  valor.trim() ? valor.trim() : vazio;

/** Parte do valor total, em centavos (30%, 70%, 50%…). */
const parte = (cents: number | null, fracao: number) =>
  cents == null ? null : Math.round(cents * fracao);

const dinheiro = (cents: number | null) =>
  cents == null ? "____________" : formatCurrency(cents);

const extenso = (cents: number | null) =>
  cents == null ? "valor por extenso" : currencyToWords(cents);

/** Trecho comum às cláusulas de remuneração dos dois modelos. */
function remuneracao(
  d: ContractData,
  opts: { quando: string; conta: string; cnpj: string; banco: string }
): string {
  const total = d.valueCents;
  const forma = d.paymentTerms.trim()
    ? `a ser pago da seguinte forma: ${d.paymentTerms.trim()}, ${opts.conta}`
    : `a ser pago da seguinte forma: 30% (equivalentes a ` +
      `${dinheiro(parte(total, 0.3))}) na assinatura do contrato e os 70% ` +
      `restantes (equivalentes a ${dinheiro(parte(total, 0.7))}) ` +
      `${opts.quando}, ${opts.conta}`;

  return (
    `**2.1 -** O CONTRATANTE pagará ao CONTRATADO o valor de ${dinheiro(total)} ` +
    `(${extenso(total)}), ${forma}. Segue o CNPJ para a realização da ` +
    `transferência: ${opts.cnpj} — ${opts.banco}.`
  );
}

/** Cláusula 4.1 — igual nos dois modelos, muda só o valor da multa. */
function multa(d: ContractData): string {
  const metade = parte(d.valueCents, 0.5);
  return (
    "**4.1 -** O presente contrato terá vigência a partir de sua assinatura até " +
    "o cumprimento integral das obrigações aqui estabelecidas. Em caso de " +
    "rescisão por iniciativa do **CONTRATANTE ou do CONTRATADO**, será aplicada " +
    `multa correspondente a 50% do valor do show, equivalente a ` +
    `${dinheiro(metade)} (${extenso(metade)}).`
  );
}

/** Qualificação do contratante — idêntica nos dois modelos. */
function contratante(d: ContractData): string {
  return (
    `**CONTRATANTE:** Nome completo: ${ou(d.clientName)}, ` +
    `CPF/CNPJ: ${ou(d.clientDocument)}, Telefone: ${ou(d.clientPhone)}, ` +
    `Endereço: ${ou(d.clientAddress)}`
  );
}

export interface ContractTemplate {
  key: ContractTemplateKey;
  label: string;
  description: string;
  /** Caminho do arquivo dentro do bucket `contratos`. */
  path: string;
  /** Nome que sai impresso sob a linha de assinatura do contratado. */
  office: string;
  /** Monta todos os textos sobrepostos ao modelo. */
  overlay: (data: ContractData) => OverlayText[];
}

export const CONTRACT_TEMPLATES: Record<ContractTemplateKey, ContractTemplate> =
  {
    carnellos: {
      key: "carnellos",
      label: "Contrato Base Carnellos",
      description:
        "Show do artista contratado direto pelo escritório Carnellos Music.",
      path: "Contranto BASE - Carnellosmusic 2026.pdf (1).pdf",
      office: "Escritório Carnellos Music",
      overlay: (d) => {
        const local = d.eventName.trim()
          ? `${d.eventName.trim()}, ${ou(d.location)}`
          : ou(d.location);
        return [
          { box: BOXES.contratante, text: contratante(d), redact: true },
          {
            box: BOXES.objeto,
            redact: true,
            justify: true,
            text:
              `O presente contrato tem por objeto a contratação do show do ` +
              `artista ${ou(d.artist)}, a ser realizado na data de ${
                d.eventDate ? formatDate(d.eventDate) : "__/__/____"
              }, em ${local}, no horário ${ou(d.eventTime, "a combinar")}.`,
          },
          {
            box: BOXES.remuneracao,
            redact: true,
            justify: true,
            text: remuneracao(d, {
              quando:
                "antes do início da apresentação do artista ou logo após o " +
                "encerramento da apresentação",
              conta: "na conta PJ do artista",
              cnpj: "64.423.267/0001-74",
              banco: "C6 Bank",
            }),
          },
          {
            box: BOXES.multa,
            redact: true,
            justify: true,
            text: multa(d),
          },
          {
            box: BOXES.localData,
            redact: true,
            text: `obriga as partes, seus herdeiros e sucessores. ${ou(
              d.city,
              "Paulínia"
            )}, ${longDate(d.signedOn)}.`,
          },
          {
            box: BOXES.rotuloContratado,
            redact: true,
            text: "Escritório Carnellos Music – CONTRATADO",
          },
          {
            box: BOXES.rotuloContratante,
            redact: true,
            text: `${ou(d.clientName)} – CONTRATANTE`,
          },
        ];
      },
    },

    producao: {
      key: "producao",
      label: "Contrato Base Produção",
      description:
        "Artistas contratados via escritório Cv.produção.artistica.",
      path: "contrato-base-producao.pdf.pdf",
      office: "Cv.produção.artistica",
      overlay: (d) => {
        // O nome do evento é opcional: sem ele a frase vai direto ao local, em
        // vez de repetir o mesmo endereço como evento E como local.
        const evento = d.eventName.trim()
          ? `no evento ${d.eventName.trim()}, `
          : "";

        return [
          { box: BOXES.contratante, text: contratante(d), redact: true },
          {
            box: BOXES.objeto,
            redact: true,
            justify: true,
            text:
              `O presente contrato tem por objeto a contratação de artistas, ` +
              `por meio do escritório Cv.produção.artistica, para ` +
              `apresentação na data de ${
                d.eventDate ? formatDate(d.eventDate) : "__/__/____"
              }, ${evento}em ${ou(d.location)}, no horário ${ou(
                d.eventTime,
                "a combinar"
              )}. Artista(s): ${ou(d.artist)}.`,
          },
          {
            box: BOXES.remuneracao,
            redact: true,
            justify: true,
            text: remuneracao(d, {
              quando:
                "antes do início das apresentações ou logo após o encerramento " +
                "da apresentação",
              conta: "na conta PJ do escritório",
              cnpj: "59.690.383/0001-10",
              banco: "Inter Empresas",
            }),
          },
          {
            box: BOXES.multa,
            redact: true,
            justify: true,
            text: multa(d),
          },
          {
            box: BOXES.localData,
            redact: true,
            text: `obriga as partes, seus herdeiros e sucessores. ${ou(
              d.city,
              "Paulínia"
            )}, ${longDate(d.signedOn)}.`,
          },
          {
            box: BOXES.rotuloContratado,
            redact: true,
            text: "Cv.produção.artistica – CONTRATADO",
          },
          {
            box: BOXES.rotuloContratante,
            redact: true,
            text: `${ou(d.clientName)} – CONTRATANTE`,
          },
        ];
      },
    },
  };

export const TEMPLATE_LIST = Object.values(CONTRACT_TEMPLATES);
