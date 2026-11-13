import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface DashboardErrorBoundaryProps {
  children: ReactNode;
}

interface DashboardErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches render errors anywhere inside the Dashboard page content and shows a
 * recoverable message in place of the page body. Only the Dashboard content is
 * replaced; the header, nav and demo banner rendered by Layout stay usable.
 */
export class DashboardErrorBoundary extends Component<
  DashboardErrorBoundaryProps,
  DashboardErrorBoundaryState
> {
  state: DashboardErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): DashboardErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Dashboard render error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return <DashboardErrorFallback />;
    }
    return this.props.children;
  }
}

/** The fallback shown when the Dashboard content fails to render. */
function DashboardErrorFallback() {
  return (
    <div className="space-y-6" data-ocid="dashboard.page">
      <div
        role="alert"
        data-ocid="dashboard.error_state"
        className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-card p-8 text-center"
      >
        <AlertTriangle
          className="h-6 w-6 text-destructive"
          aria-hidden="true"
        />
        <p className="text-base text-foreground">
          Something went wrong loading the dashboard.{" "}
          <Button
            type="button"
            variant="outline"
            className="touch-target min-h-11 align-middle"
            data-ocid="dashboard.reload_button"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Reload.
          </Button>
        </p>
      </div>
    </div>
  );
}
