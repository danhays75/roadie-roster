import { cn } from "@/lib/utils";

/**
 * The store mark: a navy disc with a red ring, a white star and three white
 * stripes. Rendered as inline SVG so it stays crisp at every size and always
 * uses the exact brand colors (navy #14284B, red #B22234, white).
 */
export function StoreLogo({
  className,
  title = "Roadie store logo",
}: {
  className?: string;
  title?: string;
}) {
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
