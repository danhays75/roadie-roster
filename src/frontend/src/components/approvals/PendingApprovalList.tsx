import type { PendingUser } from "@/backend";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { PendingApprovalCard } from "@/components/approvals/PendingApprovalCard";
import { useI18n } from "@/hooks/useI18n";

/**
 * The pending-approval queue with its loading, error, and empty states.
 * Each row owns its own approval form.
 */
export function PendingApprovalList({
  pending,
  isLoading,
  isError,
  onRetry,
}: {
  pending: PendingUser[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const { t } = useI18n();

  if (isLoading) {
    return <LoadingState label={t("approvals.loading")} />;
  }

  if (isError) {
    return <ErrorState message={t("approvals.error")} onRetry={onRetry} />;
  }

  if ((pending?.length ?? 0) === 0) {
    return <EmptyState title={t("approvals.empty")} />;
  }

  return (
    <ul className="space-y-4" data-ocid="approvals.list">
      {pending?.map((user) => (
        <PendingApprovalCard key={user.principal.toText()} user={user} />
      ))}
    </ul>
  );
}
