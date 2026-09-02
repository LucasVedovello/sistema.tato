/**
 * Motor de texto do contrato: como um parágrafo do overlay é escrito por cima
 * do modelo.
 *
 * Vive fora do `contract-render` (que cuida das páginas e das assinaturas)
 * porque é a parte que precisa ser conferida sozinha: dá para gerar um PDF só
 * com estes parágrafos, ler o texto de volta e comparar com o que deveria
 * estar escrito — sem navegador e sem o modelo em imagem.
 */

import { sanitizePdfText } from "@/lib/pdf-text";
import type { OverlayText } from "@/lib/contract-templates";

/** Uma palavra do parágrafo, com o peso da fonte com que será escrita. */
type Token = { text: string; bold: boolean };

/**
 * Quebra o texto em palavras, marcando as que estão entre `**` como negrito —
 * é assim que o overlay reproduz os destaques do modelo ("**CONTRATANTE:**").
 *
 * A varredura é caractere a caractere, e não um `split("**")`, porque a
 * marcação quase nunca cai numa fronteira de palavra: em
 * "do **CONTRATADO**." o ponto final pertence à MESMA palavra que o negrito
 * fecha. Separando por segmentos, ele virava uma palavra sozinha e o documento
 * saía com "do CONTRATADO ." — espaço antes da pontuação.
 *
 * A palavra inteira herda o peso da sua primeira letra; a diferença é
 * invisível para vírgula, ponto e parêntese, que é o caso real.
 */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let negritoAtual = false;
  let palavra = "";
  let palavraNegrito = false;

  const fechar = () => {
    if (palavra) tokens.push({ text: palavra, bold: palavraNegrito });
    palavra = "";
  };

  for (let i = 0; i < text.length; i++) {
    if (text[i] === "*" && text[i + 1] === "*") {
      negritoAtual = !negritoAtual;
      i++;
      continue;
    }
    if (/\s/.test(text[i])) {
      fechar();
      continue;
    }
    if (!palavra) palavraNegrito = negritoAtual;
    palavra += text[i];
  }
  fechar();
  return tokens;
}

const SPACE = " ";

/** Quebra os tokens em linhas que caibam na largura dada. */
export function layout(
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
 * Duas regras moldam o desenho:
 *
 * 1. Cada palavra é posicionada com coordenada própria. É o que garante que o
 *    parágrafo caia exatamente sobre o trecho do modelo que ele substitui, em
 *    QUALQUER visualizador — inclusive nos que trocam a Helvetica por uma
 *    fonte parecida (o pdf.js, usado na pré-visualização do app, é um deles) e
 *    calculariam o avanço com larguras ligeiramente diferentes.
 *
 * 2. A palavra é escrita COM o espaço que a separa da seguinte. O espaço não
 *    move nada (o próximo x já está calculado), mas existe no arquivo — e é
 *    isso que faz o texto copiado do PDF sair legível. Sem ele, o arquivo não
 *    tinha um único espaço: cada leitor adivinhava pelos vãos e emendava
 *    palavras ("CONTRATADO:CV Produção", "3.1-O CONTRATANTE"), que foi o que
 *    fez o contrato parecer errado quando na verdade estava certo.
 *
 * O texto substitui um parágrafo justificado do modelo, então as linhas
 * (menos a última) são esticadas até a margem direita — sem isso a emenda
 * entre o texto novo e o resto da página fica evidente.
 */
export function drawParagraph(
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
    line.forEach((token, indice) => {
      doc.setFont("helvetica", token.bold ? "bold" : "normal");
      const ultima = indice === line.length - 1;
      // O espaço vai junto da palavra, mas NÃO entra na conta do avanço: quem
      // manda na posição da próxima palavra é o `gap` calculado acima.
      doc.text(ultima ? token.text : token.text + SPACE, cursor, baseline);
      cursor += doc.getTextWidth(token.text) + gap;
    });

    baseline += leading();
  });
}
