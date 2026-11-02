import type { PhotoRef } from "@/backend";
import { useStoreLogo } from "@/hooks/useQueries";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

/**
 * Detect an image's real MIME type from its leading bytes. An uploaded logo is
 * stored as raw bytes with no content type, so the data URL must be built from
 * the actual format rather than assuming PNG. Recognizes PNG, JPEG, WebP and
 * SVG; falls back to `image/png` for anything unrecognized.
 */
function detectImageMimeType(bytes: Uint8Array): string {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  // SVG is text; sniff the leading markup after any UTF-8 BOM and whitespace.
  const head = new TextDecoder("utf-8", { fatal: false })
    .decode(bytes.subarray(0, 256))
    .replace(/^\uFEFF/, "")
    .trimStart()
    .toLowerCase();
  if (head.startsWith("<svg") || head.startsWith("<?xml")) {
    return "image/svg+xml";
  }
  return "image/png";
}

/** Build a data URL from raw logo bytes, using the detected image type. */
function logoBytesToDataUrl(bytes: Uint8Array): string | null {
  if (bytes.length === 0) return null;
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:${detectImageMimeType(bytes)};base64,${btoa(binary)}`;
}

/** Which of the store's two logos to render. */
export type StoreLogoVariant = "main" | "secondary";

/**
 * The store mark. The `main` variant (the default) renders the uploaded main
 * logo when an Admin has set one, otherwise the built-in navy disc with a red
 * ring, a white star and three white stripes, drawn as inline SVG so it stays
 * crisp at every size and always uses the exact brand colors (navy #14284B, red
 * #B22234, white).
 *
 * The `secondary` variant renders the uploaded secondary logo in the same
 * height-sized, aspect-preserving way, and renders nothing at all when no
 * secondary logo has been uploaded — it never falls back to the star.
 */
export function StoreLogo({
  className,
  title = "Roadie store logo",
  variant = "main",
}: {
  className?: string;
  title?: string;
  variant?: StoreLogoVariant;
}) {
  const { data: logos } = useStoreLogo();
  const bytes: PhotoRef | null =
    variant === "secondary"
      ? (logos?.secondaryLogo ?? null)
      : (logos?.logo ?? null);
  const dataUrl = useMemo(
    () => (bytes ? logoBytesToDataUrl(bytes) : null),
    [bytes],
  );

  if (dataUrl) {
    // An uploaded logo keeps its own aspect ratio: size by height and let the
    // width follow, so a wide wordmark is not squashed into a small square.
    // `w-auto` and the max-width come after `className` so tailwind-merge
    // drops any square `w-*` a caller passes while keeping its `h-*` height.
    return (
      <img
        src={dataUrl}
        alt={`${title} ${variant === "secondary" ? "secondary " : ""}logo`}
        data-ocid={
          variant === "secondary" ? "store.logo.secondary" : "store.logo"
        }
        className={cn(
          "h-10 shrink-0 object-contain",
          className,
          "w-auto max-w-[12rem]",
        )}
      />
    );
  }

  // The secondary logo has no built-in fallback: when it is absent the spot
  // stays empty rather than showing the star.
  if (variant === "secondary") return null;

  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      data-ocid="store.logo"
      className={cn("h-10 w-10 shrink-0", className)}
    >
      <title>{title}</title>
      <circle cx="32" cy="32" r="31" fill="#B22234" />
      <circle cx="32" cy="32" r="27" fill="#14284B" />
      <path
        d="M32 13.5l4.6 9.3 10.3 1.5-7.45 7.26 1.76 10.25L32 36.98l-9.21 4.84 1.76-10.25L17.1 24.3l10.3-1.5z"
        fill="#FFFFFF"
      />
      <rect x="20" y="45" width="24" height="2.6" rx="1.3" fill="#FFFFFF" />
      <rect x="23" y="50" width="18" height="2.6" rx="1.3" fill="#FFFFFF" />
    </svg>
  );
}
