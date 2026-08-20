import { useRef, useState } from "react";
import { Eraser, PenLine } from "lucide-react";

import { SignaturePad, type SignaturePadHandle } from "@/components/SignaturePad";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Coleta a assinatura de UMA das partes e devolve o PNG desenhado.
 * O mesmo diálogo serve para o cliente (link público) e para o contratado.
 */
export function SignatureDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  onConfirm: (dataUrl: string) => void;
}) {
  const padRef = useRef<SignaturePadHandle>(null);
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    if (!padRef.current || padRef.current.isEmpty()) {
      setError("Desenhe a assinatura antes de confirmar.");
      return;
    }
    setError(null);
    onConfirm(padRef.current.toDataURL());
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description ?? "Desenhe a assinatura no quadro abaixo."}
          </DialogDescription>
        </DialogHeader>

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
            <PenLine className="h-3.5 w-3.5 text-primary" />
            Assinatura
          </p>
          {/* O quadro é sempre branco, mesmo no tema escuro: é papel, não
              interface — e o traço precisa sair preto sobre branco no PDF. */}
          <div className="overflow-hidden rounded-xl border-2 border-dashed border-border bg-white">
            <SignaturePad ref={padRef} className="block h-44 w-full" />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1 text-xs text-muted-foreground"
            onClick={() => padRef.current?.clear()}
          >
            <Eraser className="h-3.5 w-3.5" />
            Limpar
          </Button>
          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm}>
            Confirmar assinatura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
