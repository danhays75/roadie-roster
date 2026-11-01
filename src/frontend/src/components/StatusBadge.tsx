import { cn } from "@/lib/utils";

type BadgeTone = "hired" | "pending" | "muted" | "danger";

const toneClasses: Record<BadgeTone, string> = {
  hired: "bg-accent text-accent-foreground",
  pending: "bg-primary text-primary-foreground",
  muted: "bg-muted text-muted-foreground",
  danger: "bg-destructive text-destructive-foreground",
};

/** A pill status badge. Blue for hired/done, red for pending, muted otherwise. */
export function StatusBadge({
  tone = "muted",
  children,
  className,
  ocid,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
  ocid?: string;
}) {
  return (
    <span
      data-ocid={ocid}
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 font-display text-[11px] font-semibold uppercase tracking-wider",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
