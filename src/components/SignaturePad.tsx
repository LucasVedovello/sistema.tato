import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export interface SignaturePadHandle {
  clear: () => void;
  isEmpty: () => boolean;
  /**
   * PNG com fundo transparente, recortado no traço — vai sobreposto ao PDF.
   *
   * O recorte importa: o quadro é bem mais largo do que alto e o campo do
   * contrato tem outra proporção, então exportar o canvas inteiro faria a
   * assinatura chegar cercada de vazio e encolhida dentro do campo.
   */
  toDataURL: () => string;
}

/**
 * Quadro de assinatura à mão (mouse, caneta ou dedo).
 *
 * Desenha com eventos de ponteiro para funcionar igual no celular e no
 * desktop; `touchAction: none` impede o navegador de rolar a página enquanto
 * a pessoa assina.
 */
export const SignaturePad = forwardRef<
  SignaturePadHandle,
  { className?: string }
>(function SignaturePad({ className }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const emptyRef = useRef(true);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  /** Extremos do traço, em pixels do canvas — base do recorte na exportação. */
  const boundsRef = useRef({
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // O canvas é redimensionado na densidade real da tela: sem isso o traço
    // sai serrilhado em telas retina e a assinatura fica borrada no PDF.
    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#111827";
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  function positionOf(event: React.PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  /** Registra o ponto nos extremos do traço (coordenadas CSS do canvas). */
  function track(point: { x: number; y: number }) {
    const b = boundsRef.current;
    b.minX = Math.min(b.minX, point.x);
    b.minY = Math.min(b.minY, point.y);
    b.maxX = Math.max(b.maxX, point.x);
    b.maxY = Math.max(b.maxY, point.y);
  }

  function handleDown(event: React.PointerEvent) {
    event.preventDefault();
    (event.target as Element).setPointerCapture(event.pointerId);
    drawingRef.current = true;
    const point = positionOf(event);
    lastRef.current = point;
    track(point);
  }

  function handleMove(event: React.PointerEvent) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    const last = lastRef.current;
    if (!ctx || !last) return;

    const point = positionOf(event);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastRef.current = point;
    track(point);
    emptyRef.current = false;
  }

  function handleUp() {
    drawingRef.current = false;
    lastRef.current = null;
  }

  useImperativeHandle(ref, () => ({
    clear: () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      boundsRef.current = {
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity,
      };
      emptyRef.current = true;
    },
    isEmpty: () => emptyRef.current,
    toDataURL: () => {
      const canvas = canvasRef.current;
      if (!canvas) return "";
      if (emptyRef.current) return canvas.toDataURL("image/png");

      const ratio = canvas.width / canvas.getBoundingClientRect().width || 1;
      const b = boundsRef.current;
      // Uma folga do tamanho do traço evita cortar a espessura da linha.
      const pad = 8;
      const left = Math.max(0, (b.minX - pad) * ratio);
      const top = Math.max(0, (b.minY - pad) * ratio);
      const right = Math.min(canvas.width, (b.maxX + pad) * ratio);
      const bottom = Math.min(canvas.height, (b.maxY + pad) * ratio);
      const width = Math.round(right - left);
      const height = Math.round(bottom - top);
      if (width <= 0 || height <= 0) return canvas.toDataURL("image/png");

      const cropped = document.createElement("canvas");
      cropped.width = width;
      cropped.height = height;
      const ctx = cropped.getContext("2d");
      if (!ctx) return canvas.toDataURL("image/png");
      ctx.drawImage(canvas, left, top, width, height, 0, 0, width, height);
      return cropped.toDataURL("image/png");
    },
  }));

  return (
    <canvas
      ref={canvasRef}
      data-testid="signature-pad"
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerLeave={handleUp}
      className={className}
      style={{ touchAction: "none" }}
    />
  );
});
