import { Button } from "@/components/ui/button";
import { useI18n } from "@/hooks/useI18n";
import { Eraser, PenLine } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A pointer-drawn manager signature on a canvas. Emits the drawn strokes as
 * raw PNG bytes so the approval stores a real signature reference, never the
 * roadie's own signature. Reuses the same drawing technique as the kiosk
 * signature step so a manager can sign on a phone.
 */
export function ManagerSignaturePad({
  value,
  onChange,
  error,
}: {
  value: Uint8Array | null;
  onChange: (bytes: Uint8Array | null) => void;
  error?: string;
}) {
  const { t } = useI18n();
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

  // Set the canvas up once on mount. Deliberately no resize listener: a drawn
  // multi-stroke signature must survive a window resize or device rotation.
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
      if (!blob) return;
      void blob
        .arrayBuffer()
        .then((buffer) => onChange(new Uint8Array(buffer)));
    }, "image/png");
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setDirty(false);
    onChange(null);
  };

  const hasSignature = value !== null && value.length > 0;

  return (
    <div className="space-y-2 md:col-span-2">
      <p className="font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {t("approvals.signup.signature.label")}
      </p>
      <div className="rounded-lg border border-border bg-card p-3">
        <canvas
          ref={canvasRef}
          data-ocid="approvals.signup.signature.canvas_target"
          aria-label={t("approvals.signup.signature.label")}
          className="h-40 w-full touch-none rounded-md border border-dashed border-input bg-white"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishStroke}
          onPointerLeave={finishStroke}
          onPointerCancel={finishStroke}
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <PenLine className="h-4 w-4" aria-hidden="true" />
            {hasSignature
              ? t("approvals.signup.signature.label")
              : t("approvals.signup.signature.required")}
          </p>
          <Button
            type="button"
            variant="outline"
            data-ocid="approvals.signup.signature.clear_button"
            onClick={clear}
            disabled={!dirty && !hasSignature}
            className="touch-target rounded-full"
          >
            <Eraser className="h-4 w-4" aria-hidden="true" />
            {t("common.cancel")}
          </Button>
        </div>
      </div>
      {error && (
        <p
          role="alert"
          data-ocid="approvals.signup.signature.error_state"
          className="text-sm font-medium text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
