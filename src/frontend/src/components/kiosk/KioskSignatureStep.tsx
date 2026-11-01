import { useKioskCopy } from "@/components/kiosk/copy";
import { Button } from "@/components/ui/button";
import { Eraser, PenLine } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Signature step: a pointer-drawn signature on a canvas.
 * Emits a PNG `File` once the user has drawn something.
 *
 * The canvas is sized once on mount. A resize or rotation must never clear a
 * drawn signature, so the setup effect has no resize listener and the drawing
 * surface keeps every stroke the user makes.
 */
export function KioskSignatureStep({
  onSigned,
  onClear,
  hasSignature,
  error,
}: {
  onSigned: (file: File) => void;
  onClear: () => void;
  hasSignature: boolean;
  error?: string;
}) {
  const t = useKioskCopy();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [dirty, setDirty] = useState(false);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#14284B";
  }, []);

  // Size the canvas once on mount. No resize listener: resizing or rotating
  // the device must preserve the strokes already drawn.
  useEffect(() => {
    setupCanvas();
  }, [setupCanvas]);

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    const { x, y } = pointFromEvent(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pointFromEvent(event);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!dirty) setDirty(true);
  };

  const finishStroke = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob)
        onSigned(new File([blob], "signature.png", { type: "image/png" }));
    }, "image/png");
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setDirty(false);
    onClear();
  };

  return (
    <div className="space-y-5" data-ocid="kiosk.signature_step">
      <div className="space-y-1">
        <h2 className="font-display text-2xl font-bold uppercase tracking-tight">
          {t("signature.title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("signature.body")}</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-3">
        <canvas
          ref={canvasRef}
          data-ocid="kiosk.signature.canvas_target"
          aria-label={t("signature.canvasLabel")}
          className="h-48 w-full touch-none rounded-md border border-dashed border-input bg-white"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishStroke}
          onPointerLeave={finishStroke}
          onPointerCancel={finishStroke}
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <PenLine className="h-4 w-4" aria-hidden="true" />
            {hasSignature ? t("signature.captured") : t("signature.prompt")}
          </p>
          <Button
            type="button"
            variant="outline"
            data-ocid="kiosk.signature.clear_button"
            onClick={clear}
            disabled={!dirty && !hasSignature}
            className="touch-target rounded-full"
          >
            <Eraser className="h-4 w-4" aria-hidden="true" />
            {t("signature.clear")}
          </Button>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          data-ocid="kiosk.signature.error_state"
          className="text-sm font-medium text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
