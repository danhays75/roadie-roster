import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertTriangle, Inbox, Loader2, RefreshCw } from "lucide-react";

/** A layout-matched loading state. */
export function LoadingState({
  label = "Loading…",
  className,
  ocid = "page.loading_state",
}: {
  label?: string;
  className?: string;
  ocid?: string;
}) {
  return (
    <output
      data-ocid={ocid}
      className={cn(
        "flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card p-8 text-muted-foreground",
        className,
      )}
    >
      <Loader2
        className="h-6 w-6 animate-spin text-primary"
        aria-hidden="true"
      />
      <span className="text-sm">{label}</span>
    </output>
  );
}

/** A recoverable error state. */
export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  className,
  ocid = "page.error_state",
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
  ocid?: string;
}) {
  return (
    <div
      data-ocid={ocid}
      className={cn(
        "flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-card p-8 text-center",
        className,
      )}
    >
      <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
      <div>
        <p className="font-display text-lg font-semibold uppercase tracking-wide text-foreground">
          {title}
        </p>
        {message && (
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        )}
      </div>
      {onRetry && (
        <Button
          type="button"
          variant="outline"
          className="touch-target"
          data-ocid="page.retry_button"
          onClick={onRetry}
        >
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Retry
        </Button>
      )}
    </div>
  );
}

/** A helpful empty state with an optional action. */
export function EmptyState({
  title,
  message,
  action,
  className,
  ocid = "page.empty_state",
}: {
  title: string;
  message?: string;
  action?: React.ReactNode;
  className?: string;
  ocid?: string;
}) {
  return (
    <div
      data-ocid={ocid}
      className={cn(
        "flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card p-8 text-center",
        className,
      )}
    >
      <Inbox className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
      <div>
        <p className="font-display text-lg font-semibold uppercase tracking-wide text-foreground">
          {title}
        </p>
        {message && (
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {message}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
