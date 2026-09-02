/**
 * Ciclo de vida de um contrato: emissão a partir do modelo do Storage,
 * assinatura do contratado e entrega do PDF final.
 *
 * O bucket `contratos` é PRIVADO. Nenhuma URL de arquivo é fixa no código nem
 * guardada no banco: toda leitura passa por `createSignedUrl`, gerada na hora
 * e válida por uma janela curta.
 */

import {
  CONTRACT_TEMPLATES,
  signatureField,
  type ContractData,
  type ContractTemplate,
  type OverlayText,
} from "@/lib/contract-templates";
import {
  composeContractPdfBlob,
  type PlacedSignature,
} from "@/lib/contract-render";
import { supabase } from "@/lib/supabase";
import { contractFileName } from "@/lib/contract-pdf";
import {
  formatDocumento,
  formatEndereco,
  formatHora,
  formatTelefone,
} from "@/lib/format";
import type {
  Client,
  ContractStatus,
  Show,
  ShowContract,
} from "@/types/database";

export const CONTRACT_BUCKET = "contratos";

/** Validade da URL assinada, em segundos (uma hora). */
const SIGNED_URL_TTL = 60 * 60;

/**
 * Caminhos dos PDFs de um contrato dentro do bucket.
 *
 * O nome usa a `storage_key`, e NÃO o token do link de assinatura: o nome do
 * arquivo é o dado menos protegido do conjunto, e vazar o token deixaria
 * qualquer um assinar no lugar do cliente.
 */
export const preparedPath = (storageKey: string) => `preparado/${storageKey}.pdf`;
export const signedPath = (storageKey: string) => `assinado/${storageKey}.pdf`;

/**
 * URL assinada de um arquivo do bucket. Curta e descartável — é gerada a cada
 * leitura, inclusive na página pública de assinatura (a policy do Storage
 * libera o anônimo apenas para o PDF do contrato do próprio token).
 */
export async function contractFileUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(CONTRACT_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (error || !data?.signedUrl) {
    throw new Error(
      error?.message ?? "Não foi possível abrir o arquivo do contrato."
    );
  }
  return data.signedUrl;
}

/** Segredo em hexadecimal, gerado no navegador. */
function newSecret(bytes: number): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return Array.from(buffer, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const STATUS_META: Record<
  ContractStatus,
  { label: string; badge: string }
> = {
  aguardando_cliente: {
    label: "Aguardando cliente",
    badge:
      "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
  },
  aguardando_contratado: {
    label: "Aguardando contratado",
    badge:
      "border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200",
  },
  assinado: {
    label: "Assinado",
    badge:
      "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  },
  cancelado: {
    label: "Cancelado",
    badge: "border-border bg-muted text-muted-foreground",
  },
};

/** Link que vai para o cliente assinar. */
export const publicSignUrl = (token: string) =>
  `${window.location.origin}/assinar/${token}`;

/**
 * URL do PDF para quem NÃO tem conta (a página pública de assinatura).
 *
 * O bucket é privado e o papel anônimo não tem acesso nenhum a ele — liberar
 * leitura por policy também liberaria a listagem, e com ela a enumeração dos
 * contratos de todo mundo. Quem valida o token e devolve o arquivo é a Edge
 * Function `contrato-pdf`.
 */
export const publicContractPdfUrl = (
  token: string,
  tipo: "preparado" | "assinado" = "preparado"
) =>
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contrato-pdf` +
  `?token=${encodeURIComponent(token)}&tipo=${tipo}`;

const PRAZO_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Como mostrar o prazo de assinatura de um contrato.
 *
 * Vencido não é um estado que a tela invente: quem vira a chave é
 * `expire_overdue_contracts`, no banco. Aqui é só a leitura — um contrato
 * pendente com data no passado está esperando a próxima rodada.
 */
export function deadlineInfo(contract: {
  status: ContractStatus;
  deadline_at: string;
}): { texto: string; vencido: boolean; relevante: boolean } {
  const prazo = new Date(contract.deadline_at);
  const vencido = prazo.getTime() < Date.now();
  const pendente =
    contract.status === "aguardando_cliente" ||
    contract.status === "aguardando_contratado";

  return {
    texto: PRAZO_FORMAT.format(prazo),
    vencido: pendente && vencido,
    // Depois de assinado ou cancelado o prazo não diz mais nada.
    relevante: pendente,
  };
}

/**
 * Campos que o modelo pede e o cadastro do show não tem.
 *
 * O endereço do contratante saiu daqui: ele agora vem do cadastro do cliente,
 * em campos separados, e é montado sempre pelo mesmo `formatEndereco`. Digitado
 * à mão a cada emissão, ele saía diferente em cada contrato.
 */
export interface ContractExtras {
  eventName: string;
  eventTime: string;
  city: string;
}

export const emptyExtras: ContractExtras = {
  eventName: "",
  eventTime: "",
  city: "Paulínia",
};

/**
 * Junta show + cliente + campos avulsos no formato que o modelo consome.
 *
 * Nomes: o contrato leva SEMPRE o nome completo; o nome da ficha (artístico,
 * curto) fica nas telas. Sem nome completo cadastrado a lacuna seria pior que
 * o nome curto, então ele entra como reserva.
 *
 * Documento, telefone e endereço passam pelas funções de `lib/format` — as
 * mesmas do formulário e das planilhas —, então o contrato imprime exatamente
 * o que a ficha do cliente mostra.
 *
 * Horário: o do cadastro do show é o padrão, e o campo avulso do diálogo
 * continua podendo sobrescrevê-lo — ele aceita formas que a coluna `time` não
 * guarda ("23h às 01h").
 */
export function buildContractData(
  show: Show,
  client: Client | null,
  extras: ContractExtras
): ContractData {
  return {
    artist: show.artist_full_name?.trim() || show.artist_name,
    clientName: client?.full_name?.trim() || client?.name || "",
    clientDocument: formatDocumento(client?.document),
    clientPhone: formatTelefone(client?.phone),
    clientAddress: client ? formatEndereco(client) : "",
    eventName: extras.eventName,
    eventDate: show.event_date,
    eventTime: extras.eventTime.trim() || formatHora(show.event_time),
    location: show.location ?? "",
    valueCents: show.value_cents,
    paymentTerms: show.payment_terms ?? "",
    city: extras.city,
    signedOn: new Date(),
  };
}

/**
 * Emite o contrato:
 *   modelo do bucket -> overlay dos dados do show -> `preparado/<token>.pdf`
 *   -> linha em `show_contracts` (o gatilho registra na timeline do show).
 *
 * O PDF sobe ANTES do registro: um arquivo sem linha é lixo inofensivo, mas uma
 * linha sem arquivo apareceria na ficha como um contrato que não abre.
 */
export async function createContract(params: {
  show: Show;
  client: Client | null;
  templateKey: ContractTemplate["key"];
  extras: ContractExtras;
  authorEmail: string | null;
}): Promise<ShowContract> {
  const { show, client, templateKey, extras, authorEmail } = params;
  const template = CONTRACT_TEMPLATES[templateKey];

  const data = buildContractData(show, client, extras);
  const overlay: OverlayText[] = template.overlay(data);

  // Os dois segredos nascem aqui porque o caminho do arquivo precisa existir
  // antes do upload, que acontece antes do INSERT.
  const token = newSecret(24);
  const storageKey = newSecret(16);
  const modelUrl = await contractFileUrl(template.path);

  const blob = await composeContractPdfBlob({ url: modelUrl, texts: overlay });

  const path = preparedPath(storageKey);
  const { error: uploadError } = await supabase.storage
    .from(CONTRACT_BUCKET)
    .upload(path, blob, { contentType: "application/pdf", upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { data: row, error } = await supabase
    .from("show_contracts")
    .insert({
      show_id: show.id,
      template_key: template.key,
      template_label: template.label,
      template_path: template.path,
      overlay,
      public_token: token,
      storage_key: storageKey,
      client_name: data.clientName || "Contratante",
      office_name: template.office,
      prepared_pdf_path: path,
      created_by_email: authorEmail,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return row as ShowContract;
}

/**
 * Assinatura do CONTRATADO — o último passo. Só pode acontecer depois da
 * assinatura do cliente (a checagem de status é repetida no banco pela RPC do
 * cliente, e aqui pelo filtro do update).
 *
 * É neste momento que o PDF final nasce: o contrato preparado ao fundo e as
 * duas assinaturas por cima.
 */
export async function signAsOffice(
  contract: ShowContract,
  signatureDataUrl: string
): Promise<ShowContract> {
  if (contract.status !== "aguardando_contratado") {
    throw new Error(
      "O cliente ainda não assinou este contrato — o campo do contratado só é liberado depois."
    );
  }
  if (!contract.client_signature) {
    throw new Error("A assinatura do cliente não foi encontrada no contrato.");
  }

  const preparedUrl = await contractFileUrl(contract.prepared_pdf_path);
  const signatures: PlacedSignature[] = [
    {
      dataUrl: contract.client_signature,
      box: signatureField("client").box,
    },
    { dataUrl: signatureDataUrl, box: signatureField("office").box },
  ];

  const blob = await composeContractPdfBlob({ url: preparedUrl, signatures });
  const path = signedPath(contract.storage_key);

  const { error: uploadError } = await supabase.storage
    .from(CONTRACT_BUCKET)
    .upload(path, blob, { contentType: "application/pdf", upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { data, error } = await supabase
    .from("show_contracts")
    .update({
      office_signature: signatureDataUrl,
      office_signed_at: new Date().toISOString(),
      status: "assinado",
      signed_pdf_path: path,
    })
    .eq("id", contract.id)
    .eq("status", "aguardando_contratado")
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as ShowContract;
}

/**
 * Exclui o contrato e os PDFs dele.
 *
 * Os arquivos saem primeiro: uma linha sem arquivo apareceria na ficha como um
 * contrato que não abre, enquanto um arquivo sem linha é só lixo — e o Storage
 * não tem cascade a partir do banco.
 */
export async function deleteContract(contract: ShowContract): Promise<void> {
  const caminhos = [
    contract.prepared_pdf_path,
    contract.signed_pdf_path,
  ].filter((path): path is string => Boolean(path));

  if (caminhos.length > 0) {
    const { error } = await supabase.storage
      .from(CONTRACT_BUCKET)
      .remove(caminhos);
    // Falhar aqui não pode impedir a exclusão: o registro é o que importa.
    if (error) console.error("[contracts] falha ao remover PDFs", error);
  }

  const { error } = await supabase
    .from("show_contracts")
    .delete()
    .eq("id", contract.id);
  if (error) throw new Error(error.message);
}

/** Baixa um PDF do contrato com nome legível. */
export async function downloadContractFile(
  path: string,
  artist: string,
  eventDate: string | null
) {
  const url = await contractFileUrl(path);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Não foi possível baixar o contrato.");
  const blob = await res.blob();

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = contractFileName(artist, eventDate);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
