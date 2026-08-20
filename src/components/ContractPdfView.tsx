import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { renderPdfToImages } from "@/lib/contract-render";
import type { Box } from "@/lib/contract-templates";
import { cn } from "@/lib/utils";

export type SignatureOverlay = {
  box: Box;
  /** PNG da assinatura, quando já assinada. */
  imageUrl?: string | null;
  /** Texto do campo vazio ("Assine aqui"). */
  label?: string;
  party: "client" | "office";
};

type Page = { number: number; src: string };

const PARTY_STYLES: Record<SignatureOverlay["party"], string> = {
  client:
    "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  office: "border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300",
};

/**
 * Mostra o contrato como ele é: cada página do PDF vira imagem e é empilhada,
 * com os campos de assinatura desenhados por cima em coordenadas
 * proporcionais — as mesmas usadas para gerar o PDF final, então o que aparece
 * na tela é o que sai no documento.
 */
export function ContractPdfView({
  url,
  overlays = [],
  className,
}: {
  url: string;
  overlays?: SignatureOverlay[];
  className?: string;
}) {
  const [pages, setPages] = useState<Page[]>([]);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    setPages([]);
    setStatus("loading");

    (async () => {
      try {
        // Resolução menor que a do PDF final: aqui é leitura em tela.
        const rendered = await renderPdfToImages(url, 1000, "image/png");
        if (cancelled) return;
        setPages(rendered.map((page, i) => ({ number: i + 1, src: page.dataUrl })));
        setStatus("done");
      } catch (err) {
        console.error("[ContractPdfView] falha ao renderizar o contrato", err);
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className={cn("space-y-4", className)}>
      {pages.map((page) => (
        <div key={page.number} className="relative w-full">
          <img
            src={page.src}
            alt={`Página ${page.number} do contrato`}
            className="w-full select-none rounded-lg border border-border shadow-sm"
            draggable={false}
          />
          {overlays
            .filter((overlay) => overlay.box.page === page.number)
            .map((overlay, index) => (
              <div
                key={`${overlay.party}-${index}`}
                className={cn(
                  "absolute flex items-center justify-center overflow-hidden rounded-md",
                  overlay.imageUrl
                    ? ""
                    : cn("border-2 border-dashed", PARTY_STYLES[overlay.party])
                )}
                style={{
                  left: `${overlay.box.x * 100}%`,
                  top: `${overlay.box.y * 100}%`,
                  width: `${overlay.box.w * 100}%`,
                  height: `${overlay.box.h * 100}%`,
                }}
              >
                {overlay.imageUrl ? (
                  <img
                    src={overlay.imageUrl}
                    alt="Assinatura"
                    /* Apoiada na base, como no PDF: é ali que fica a linha
                       impressa do contrato. */
                    className="h-full w-full object-contain object-bottom"
                  />
                ) : (
                  <span className="px-1 text-center text-[10px] font-semibold uppercase leading-tight sm:text-xs">
                    {overlay.label}
                  </span>
                )}
              </div>
            ))}
        </div>
      ))}

      {status === "loading" && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando o contrato…
        </div>
      )}
      {status === "error" && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Não foi possível carregar o contrato. Recarregue a página e tente de
          novo.
        </p>
      )}
    </div>
  );
}
