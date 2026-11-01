import { KioskField } from "@/components/kiosk/KioskField";
import { useKioskCopy } from "@/components/kiosk/copy";
import { Button } from "@/components/ui/button";
import { useCamera } from "@caffeineai/camera";
import { Camera, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

/** Read a `File` into a data URL for previewing without a storage round trip. */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the photo"));
    reader.readAsDataURL(file);
  });
}

/**
 * Photo step: live device-camera preview with capture, retake and switch.
 * Falls back to a file picker when the browser exposes no camera.
 */
export function KioskPhotoStep({
  photo,
  onCapture,
  onClear,
}: {
  photo: File | null;
  onCapture: (file: File) => void;
  onClear: () => void;
}) {
  const t = useKioskCopy();
  const {
    isActive,
    isSupported,
    error,
    isLoading,
    currentFacingMode,
    startCamera,
    stopCamera,
    capturePhoto,
    switchCamera,
    retry,
    videoRef,
    canvasRef,
  } = useCamera({ facingMode: "user", width: 720, height: 720 });

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // The preview data URL is derived once per captured file and memoized, so a
  // re-render never re-reads the file.
  const previewDataUrl = useMemo(() => photo, [photo]);

  useEffect(() => {
    if (!previewDataUrl) {
      setPreviewUrl(null);
      return;
    }
    let active = true;
    void fileToDataUrl(previewDataUrl).then((url) => {
      if (active) setPreviewUrl(url);
    });
    return () => {
      active = false;
    };
  }, [previewDataUrl]);

  useEffect(() => {
    if (isSupported) void startCamera();
    return () => {
      void stopCamera();
    };
  }, [isSupported, startCamera, stopCamera]);

  const handleCapture = async () => {
    const file = await capturePhoto();
    if (file) onCapture(file);
  };

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onCapture(file);
    event.target.value = "";
  };

  return (
    <div className="space-y-5" data-ocid="kiosk.photo_step">
      <div className="space-y-1">
        <h2 className="font-display text-2xl font-bold uppercase tracking-tight">
          {t("photo.title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("photo.body")}</p>
      </div>

      <div className="mx-auto w-full max-w-md">
        <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-border bg-secondary">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={t("photo.previewAlt")}
              className="h-full w-full object-cover"
            />
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                className="h-full w-full object-cover"
              />
              {!isActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-secondary/90 p-6 text-center text-secondary-foreground">
                  <Camera className="h-8 w-8" aria-hidden="true" />
                  <p className="text-sm">
                    {isSupported === false
                      ? t("photo.unsupported")
                      : isLoading
                        ? t("photo.starting")
                        : t("photo.idle")}
                  </p>
                </div>
              )}
            </>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {error && !previewUrl && (
          <p
            role="alert"
            data-ocid="kiosk.photo.error_state"
            className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          >
            {error.type === "permission"
              ? t("photo.error.permission")
              : t("photo.error.generic")}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          {previewUrl ? (
            <Button
              type="button"
              variant="outline"
              data-ocid="kiosk.photo.retake_button"
              onClick={onClear}
              className="touch-target rounded-full"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              {t("photo.retake")}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                data-ocid="kiosk.photo.capture_button"
                onClick={handleCapture}
                disabled={!isActive || isLoading}
                className="touch-target h-12 rounded-full px-6 font-display uppercase tracking-wider"
              >
                <Camera className="h-5 w-5" aria-hidden="true" />
                {t("photo.capture")}
              </Button>
              {isSupported && (
                <Button
                  type="button"
                  variant="outline"
                  data-ocid="kiosk.photo.switch_button"
                  onClick={() => void switchCamera()}
                  disabled={!isActive || isLoading}
                  className="touch-target rounded-full"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  {currentFacingMode === "user"
                    ? t("photo.switchToBack")
                    : t("photo.switchToFront")}
                </Button>
              )}
              {error && (
                <Button
                  type="button"
                  variant="outline"
                  data-ocid="kiosk.photo.retry_button"
                  onClick={() => void retry()}
                  className="touch-target rounded-full"
                >
                  {t("common.retry")}
                </Button>
              )}
            </>
          )}
        </div>

        {!previewUrl && (
          <div className="mt-4 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={handleFile}
            />
            <Button
              type="button"
              variant="ghost"
              data-ocid="kiosk.photo.upload_button"
              onClick={() => fileInputRef.current?.click()}
              className="touch-target rounded-full text-muted-foreground"
            >
              {t("photo.useFile")}
            </Button>
          </div>
        )}

        {previewUrl && (
          <div className="mt-3 flex justify-center">
            <Button
              type="button"
              variant="ghost"
              data-ocid="kiosk.photo.remove_button"
              onClick={onClear}
              className="touch-target rounded-full text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {t("photo.remove")}
            </Button>
          </div>
        )}
      </div>

      <KioskField
        id="kiosk-photo-note"
        label={t("photo.noteLabel")}
        hint={t("photo.noteHint")}
      >
        <p className="text-sm text-muted-foreground">
          {photo ? t("photo.ready") : t("photo.notReady")}
        </p>
      </KioskField>
    </div>
  );
}
