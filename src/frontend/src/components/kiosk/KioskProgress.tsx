import { cn } from "@/lib/utils";

/** A step indicator for the kiosk flow: numbered dots plus a progress bar. */
export function KioskProgress({
  steps,
  current,
  label,
}: {
  steps: string[];
  current: number;
  label: string;
}) {
  const pct = Math.round(((current + 1) / steps.length) * 100);
  return (
    <div className="space-y-3" data-ocid="kiosk.progress">
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">
          {label}
        </p>
        <p className="text-xs font-medium text-muted-foreground">
          {current + 1} / {steps.length}
        </p>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        tabIndex={0}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <ol className="hidden flex-wrap gap-x-4 gap-y-1 sm:flex">
        {steps.map((step, index) => (
          <li
            key={step}
            className={cn(
              "flex items-center gap-1.5 text-xs",
              index === current
                ? "font-semibold text-foreground"
                : index < current
                  ? "text-accent"
                  : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-semibold",
                index === current
                  ? "border-primary bg-primary text-primary-foreground"
                  : index < current
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border bg-card text-muted-foreground",
              )}
            >
              {index + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
    </div>
  );
}
