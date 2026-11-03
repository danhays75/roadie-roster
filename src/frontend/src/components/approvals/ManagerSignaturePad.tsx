import { Button } from "@/components/ui/button";
import { useDemo } from "@/hooks/useDemo";
import { useI18n } from "@/hooks/useI18n";
import { Eraser, PenLine, Wand2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A sample signature drawn as normalized points (0..1 of the canvas box), so
 * the demo "Sign as Test" button can fill the pad at any canvas size. The path
 * is a single flowing cursive stroke that reads as a signature.
 */
const SAMPLE_SIGNATURE: Array<[number, number]> = [
  [0.08, 0.68],
  [0.12, 0.42],
  [0.16, 0.3],
  [0.2, 0.34],
  [0.22, 0.52],
  [0.24, 0.66],
  [0.28, 0.6],
  [0.32, 0.44],
  [0.36, 0.38],
  [0.4, 0.46],
  [0.42, 0.6],
  [0.46, 0.64],
  [0.5, 0.5],
  [0.54, 0.36],
  [0.58, 0.4],
  [0.6, 0.56],
  [0.64, 0.62],
  [0.68, 0.48],
  [0.72, 0.34],
  [0.76, 0.4],
  [0.8, 0.58],
  [0.86, 0.62],
  [0.92, 0.5],
];

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
  const demo = useDemo();
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

  // Demo only: fill the pad with a sample signature and emit it as PNG bytes,
  // exactly as a real stroke would. The canvas is redrawn so the visible pad
  // matches the captured signature.
  const signAsTest = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    SAMPLE_SIGNATURE.forEach(([nx, ny], index) => {
      const x = nx * rect.width;
      const y = ny * rect.height;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    setDirty(true);
    canvas.toBlob((blob) => {
      if (!blob) return;
      void blob
        .arrayBuffer()
        .then((buffer) => onChange(new Uint8Array(buffer)));
    }, "image/png");
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
        {demo.enabled && (
          <Button
            type="button"
            variant="secondary"
            data-ocid="approvals.signup.signature.sign_as_test_button"
            onClick={signAsTest}
            className="touch-target mt-3 w-full rounded-full"
          >
            <Wand2 className="h-4 w-4" aria-hidden="true" />
            {t("demo.signAsTest")}
          </Button>
        )}
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
