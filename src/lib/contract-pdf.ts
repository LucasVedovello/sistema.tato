import type { ContractTemplate } from "@/lib/contract-template";
import { sanitizePdfText as sanitize } from "@/lib/pdf-text";

/** Medidas da página, em mm (A4 retrato). */
const PAGE = { width: 210, height: 297, margin: 20 };
const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2;
/** A partir desta altura, quebra para a página seguinte. */
const BOTTOM_LIMIT = PAGE.height - PAGE.margin;

/**
 * Gera e baixa o contrato em PDF.
 *
 * O jsPDF entra por import dinâmico: só é baixado quando o usuário clica em
 * baixar, ficando fora do bundle inicial do app.
 */
export async function downloadContractPdf(
  contract: ContractTemplate,
  fileName: string
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  let y = PAGE.margin;

  function ensureSpace(needed: number) {
    if (y + needed > BOTTOM_LIMIT) {
      doc.addPage();
      y = PAGE.margin;
    }
  }

  function writeParagraph(
    text: string,
    options: {
      bold?: boolean;
      size?: number;
      gap?: number;
      align?: "left" | "center";
    } = {}
  ) {
    const { bold = false, size = 11, gap = 4, align = "left" } = options;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);

    const lineHeight = size * 0.5;
    const lines = doc.splitTextToSize(
      sanitize(text),
      CONTENT_WIDTH
    ) as string[];

    for (const line of lines) {
      ensureSpace(lineHeight);
      if (align === "center") {
        doc.text(line, PAGE.width / 2, y, { align: "center" });
      } else {
        doc.text(line, PAGE.margin, y);
      }
      y += lineHeight;
    }
    y += gap;
  }

  writeParagraph(contract.title, {
    bold: true,
    size: 14,
    align: "center",
    gap: 8,
  });
  writeParagraph(contract.preamble, { gap: 6 });

  for (const clause of contract.clauses) {
    // Evita cabeçalho órfão no rodapé da página.
    ensureSpace(18);
    writeParagraph(clause.heading, { bold: true, gap: 2 });
    writeParagraph(clause.body, { gap: 6 });
  }

  writeParagraph(contract.closing, { gap: 10 });
  writeParagraph(contract.placeAndDate, { gap: 16 });

  for (const signature of contract.signatures) {
    ensureSpace(24);
    doc.setDrawColor(0);
    doc.line(PAGE.margin, y, PAGE.margin + 80, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(sanitize(signature.name), PAGE.margin, y);
    y += 5;
    doc.setFontSize(9);
    doc.text(sanitize(signature.role), PAGE.margin, y);
    y += 14;
  }

  doc.save(fileName);
}

/** "Trio Parada Dura" + "2026-09-12" -> "contrato-trio-parada-dura-2026-09-12.pdf" */
export function contractFileName(artist: string, eventDate: string | null) {
  const slug = artist
    .normalize("NFD")
    // Remove os acentos que o NFD separou das letras; sem isso eles virariam
    // hífens na próxima linha ("Marília" -> "marili-a").
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `contrato-${slug || "show"}${eventDate ? `-${eventDate}` : ""}.pdf`;
}
