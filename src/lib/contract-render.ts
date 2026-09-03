/**
 * Montagem do PDF do contrato.
 *
 * REGRA: o resultado tem de ser visualmente o MESMO documento que o escritório
 * enviou para o bucket. Nada é rediagramado — cada página do modelo entra como
 * imagem de fundo, em tamanho original, e por cima vão só os dados do show e as
 * assinaturas. A técnica é a mesma já validada no odonto-sign:
 *   1. pdf.js renderiza cada página do modelo num canvas;
 *   2. jsPDF cria uma página do mesmo tamanho com essa imagem ao fundo;
 *   3. os campos são desenhados por cima, em coordenadas proporcionais.
 *
 * Tanto o pdf.js quanto o jsPDF entram por import dinâmico: só são baixados
 * quando alguém emite ou assina um contrato, ficando fora do bundle inicial.
 */

import type { Box, OverlayText } from "@/lib/contract-templates";
import { drawParagraph } from "@/lib/contract-text";

/**
 * Quanto a tarja branca sobe além da caixa, em fração do corpo da fonte.
 *
 * 0,15 (1,65 pt em corpo 11) cobre com folga o acento das maiúsculas — que
 * sobe 10,2 pt da linha de base — sem alcançar a linha de cima, cuja perna
 * mais funda (g, p, q) desce só 2,4 pt.
 */
const MARGEM_ACENTO = 0.15;

export type RenderedPage = {
  /** Imagem da página renderizada (data URL). */
  dataUrl: string;
  /** Largura da página em pontos PDF (viewport na escala 1). */
  width: number;
  /** Altura da página em pontos PDF. */
  height: number;
};

export type PlacedSignature = {
  /** PNG transparente da assinatura, em data URL. */
  dataUrl: string;
  box: Box;
};

/** Busca o binário do PDF, com uma nova tentativa (rede instável). */
async function fetchPdfBytes(url: string, attempt = 0): Promise<ArrayBuffer> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.arrayBuffer();
  } catch (err) {
    if (attempt < 1) return fetchPdfBytes(url, attempt + 1);
    throw err;
  }
}

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  // `?url` devolve só a URL do asset — o worker é servido pelo próprio Vite,
  // sem CDN externa.
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url"))
    .default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs;
}

/**
 * Renderiza todas as páginas de um PDF como imagem, preservando as dimensões
 * originais em pontos (para reconstruir um PDF do mesmo tamanho).
 *
 * `targetWidth` maior = documento final mais nítido e mais pesado. 1400 px é o
 * ponto em que o texto do modelo ainda sai limpo numa impressão A4.
 */
export async function renderPdfToImages(
  url: string,
  targetWidth = 1400,
  format: "image/jpeg" | "image/png" = "image/jpeg"
): Promise<RenderedPage[]> {
  const pdfjs = await loadPdfjs();
  const buf = await fetchPdfBytes(url);

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const pages: RenderedPage[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const base = page.getViewport({ scale: 1 }); // dimensões em pontos
    const scale = Math.min(Math.max(targetWidth / base.width, 1.5), 3) * dpr;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;

    const dataUrl = canvas.toDataURL(format, 0.92);
    // Libera a memória do canvas antes da próxima página (documentos de várias
    // páginas em alta resolução estouram a aba se ficarem todos vivos).
    canvas.width = 0;
    canvas.height = 0;

    pages.push({ dataUrl, width: base.width, height: base.height });
  }

  return pages;
}

/**
 * Desenha a assinatura dentro do campo SEM deformá-la: a imagem é ajustada ao
 * campo pelo lado que primeiro encosta e centralizada na horizontal, apoiada
 * na base (é ali que fica a linha impressa do contrato). Esticar para preencher
 * o campo achataria a assinatura, que é sempre mais alta que o campo é fundo.
 */
function drawSignature(
  doc: import("jspdf").jsPDF,
  signature: PlacedSignature,
  pageW: number,
  pageH: number
) {
  const boxX = signature.box.x * pageW;
  const boxY = signature.box.y * pageH;
  const boxW = signature.box.w * pageW;
  const boxH = signature.box.h * pageH;

  let w = boxW;
  let h = boxH;
  try {
    const props = doc.getImageProperties(signature.dataUrl);
    if (props.width > 0 && props.height > 0) {
      const scale = Math.min(boxW / props.width, boxH / props.height);
      w = props.width * scale;
      h = props.height * scale;
    }
  } catch {
    // Sem as dimensões da imagem, cai no comportamento antigo (preencher).
  }

  doc.addImage(
    signature.dataUrl,
    "PNG",
    boxX + (boxW - w) / 2,
    boxY + (boxH - h),
    w,
    h
  );
}

export type ComposeInput = {
  /** URL (assinada) do PDF a usar como fundo. */
  url: string;
  /** Textos sobrepostos — vazio quando o fundo já é o contrato preparado. */
  texts?: OverlayText[];
  signatures?: PlacedSignature[];
};

/**
 * Monta o PDF: páginas do original ao fundo, campos por cima.
 * Devolve a instância do jsPDF (use `.output("blob")` para subir/baixar).
 */
export async function composeContractPdf({
  url,
  texts = [],
  signatures = [],
}: ComposeInput): Promise<import("jspdf").jsPDF> {
  const { jsPDF } = await import("jspdf");
  const pages = await renderPdfToImages(url);
  if (pages.length === 0) {
    throw new Error("O PDF do modelo não tem páginas que possam ser renderizadas.");
  }

  const orientation = (w: number, h: number) => (h >= w ? "p" : "l");
  const [first] = pages;
  const doc = new jsPDF({
    unit: "pt",
    format: [first.width, first.height],
    orientation: orientation(first.width, first.height),
  });

  pages.forEach((page, index) => {
    if (index > 0) {
      doc.addPage([page.width, page.height], orientation(page.width, page.height));
    }

    try {
      doc.addImage(page.dataUrl, "JPEG", 0, 0, page.width, page.height);
    } catch {
      // Se a imagem falhar, a página fica em branco no tamanho certo em vez de
      // derrubar a geração inteira.
    }

    for (const field of texts.filter((t) => t.box.page === index + 1)) {
      if (field.redact) {
        doc.setFillColor(255, 255, 255);
        // A tarja sobe um pouco além da caixa. As caixas foram medidas pela
        // linha de base do texto do modelo (9,5 pt acima dela), o que cobre
        // maiúsculas e minúsculas acentuadas — mas NÃO o acento de uma
        // maiúscula: em Helvetica, "Á"/"Ã"/"Ê"/"Õ" chegam a 0,929 em, ou seja
        // 10,2 pt num corpo 11. Ficava para trás uma fatia do acento original,
        // deslocada 2 pt do acento novo, e o título saía com dois acentos
        // sobre a mesma letra — sempre nos TÍTULOS, que são a única parte do
        // documento escrita em caixa alta.
        const margem = (field.size ?? 11) * MARGEM_ACENTO;
        doc.rect(
          field.box.x * page.width,
          field.box.y * page.height - margem,
          field.box.w * page.width,
          field.box.h * page.height + margem,
          "F"
        );
      }
      drawParagraph(doc, field, page.width, page.height);
    }

    for (const signature of signatures.filter((s) => s.box.page === index + 1)) {
      try {
        drawSignature(doc, signature, page.width, page.height);
      } catch {
        // Uma assinatura corrompida não pode impedir o resto do documento.
      }
    }
  });

  return doc;
}

/** Mesma composição, devolvida como Blob (para subir no Storage). */
export async function composeContractPdfBlob(
  input: ComposeInput
): Promise<Blob> {
  const doc = await composeContractPdf(input);
  return doc.output("blob");
}
