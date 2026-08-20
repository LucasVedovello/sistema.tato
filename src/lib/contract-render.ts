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
import { sanitizePdfText } from "@/lib/pdf-text";

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

/** Uma palavra do parágrafo, com o peso da fonte com que será escrita. */
type Token = { text: string; bold: boolean };

/**
 * Quebra o texto em palavras, marcando as que estão entre `**` como negrito —
 * é assim que o overlay reproduz os destaques do modelo ("**2.1 -**",
 * "**CONTRATANTE:**").
 */
function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  // Segmentos alternados: fora de **, dentro de **, fora, ...
  text.split("**").forEach((segment, index) => {
    const bold = index % 2 === 1;
    for (const word of segment.split(/\s+/)) {
      if (word) tokens.push({ text: word, bold });
    }
  });
  return tokens;
}

const SPACE = " ";

/** Quebra os tokens em linhas que caibam na largura dada. */
function layout(
  doc: import("jspdf").jsPDF,
  tokens: Token[],
  width: number
): Token[][] {
  const measure = (token: Token) => {
    doc.setFont("helvetica", token.bold ? "bold" : "normal");
    return doc.getTextWidth(token.text);
  };
  const spaceWidth = () => {
    doc.setFont("helvetica", "normal");
    return doc.getTextWidth(SPACE);
  };

  const lines: Token[][] = [];
  let current: Token[] = [];
  let used = 0;

  for (const token of tokens) {
    const w = measure(token);
    const extra = current.length === 0 ? w : spaceWidth() + w;
    if (current.length > 0 && used + extra > width) {
      lines.push(current);
      current = [token];
      used = w;
    } else {
      current.push(token);
      used += extra;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

/**
 * Escreve um parágrafo dentro da caixa, reduzindo o corpo da fonte até caber.
 *
 * O texto substitui um parágrafo justificado do modelo, então as linhas
 * (menos a última) são esticadas até a margem direita — sem isso a emenda
 * entre o texto novo e o resto da página fica evidente.
 */
function drawParagraph(
  doc: import("jspdf").jsPDF,
  field: OverlayText,
  pageW: number,
  pageH: number
) {
  const text = sanitizePdfText(field.text ?? "").trim();
  if (!text) return;

  const x = field.box.x * pageW;
  const y = field.box.y * pageH;
  const w = field.box.w * pageW;
  const h = field.box.h * pageH;

  doc.setTextColor(0, 0, 0);
  const tokens = tokenize(text);

  let size = field.size ?? 11;
  let lines: Token[][] = [];
  const leading = () => size * 1.29; // entrelinha do modelo: 14,25 pt em 11 pt

  for (;;) {
    doc.setFontSize(size);
    lines = layout(doc, tokens, w);
    if (lines.length * leading() <= h || size <= 6) break;
    size -= 0.25;
  }

  const widthOf = (token: Token) => {
    doc.setFont("helvetica", token.bold ? "bold" : "normal");
    return doc.getTextWidth(token.text);
  };
  doc.setFont("helvetica", "normal");
  const spaceWidth = doc.getTextWidth(SPACE);

  // Linha de base da primeira linha: o topo da caixa mais o ascendente.
  let baseline = y + size * 0.85;

  lines.forEach((line, index) => {
    const isLast = index === lines.length - 1;
    const wordsWidth = line.reduce((sum, token) => sum + widthOf(token), 0);
    const natural = wordsWidth + spaceWidth * (line.length - 1);

    const gap =
      field.justify && !isLast && line.length > 1 && natural < w
        ? (w - wordsWidth) / (line.length - 1)
        : spaceWidth;

    let cursor = x;
    for (const token of line) {
      doc.setFont("helvetica", token.bold ? "bold" : "normal");
      doc.text(token.text, cursor, baseline);
      cursor += doc.getTextWidth(token.text) + gap;
    }

    baseline += leading();
  });
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
        doc.rect(
          field.box.x * page.width,
          field.box.y * page.height,
          field.box.w * page.width,
          field.box.h * page.height,
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
