import { PageHeader } from "@/components/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { FlipCard } from "@/components/roadie/FlipCard";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/hooks/useI18n";
import { useLeaders, usePositions } from "@/hooks/useQueries";
import { staffDisplayName } from "@/lib/format";
import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useMemo } from "react";

/**
 * A single leader's full flip card. The leader is looked up from the leaders
 * roster by the route's principal, so the page reads the same list the grid
 * does. A trainer's stations are resolved from the position list and passed to
 * the shared card, which renders the tier ribbon, title pill, station pill,
 * footers and About Me back table.
 */
export default function LeaderCardPage() {
  const { t } = useI18n();
  const { leaderId } = useParams({ from: "/leaders/$leaderId" });
  const { data: leaders, isLoading, isError, refetch } = useLeaders(true);
  const { data: positions } = usePositions();

  const leader = useMemo(
    () =>
      (leaders ?? []).find((item) => item.principal.toString() === leaderId),
    [leaders, leaderId],
  );

  const trainerPositions = useMemo(() => {
    if (!leader) return [];
    const ids = new Set(leader.trainerPositionIds.map((id) => id.toString()));
    return (positions ?? []).filter((position) =>
      ids.has(position.id.toString()),
    );
  }, [leader, positions]);

  // The card's tier ribbon and trainer treatment follow the role the leader
  // stated on their staff profile, falling back to their access-grant role.
  // The store owner is bootstrapped as an Admin, so their grant role alone
  // would show them as a Market Partner even when they told us they are a
  // Store Manager.
  const cardLeader = useMemo(
    () =>
      leader
        ? { ...leader, role: leader.staffProfile?.requestedRole ?? leader.role }
        : undefined,
    [leader],
  );

  const backButton = (
    <Button
      asChild
      variant="ghost"
      className="touch-target -ml-2"
      data-ocid="leaders.card.back_button"
    >
      <Link to="/leaders">
        <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
        {t("leaders.card.back")}
      </Link>
    </Button>
  );

  return (
    <div className="space-y-6" data-ocid="leaders.card.page">
      {backButton}

      {isLoading && <LoadingState label={t("leaders.card.loading")} />}
      {isError && (
        <ErrorState
          message={t("leaders.card.error")}
          onRetry={() => void refetch()}
        />
      )}

      {!isLoading && !isError && !leader && (
        <EmptyState title={t("leaders.card.notFound")} />
      )}

      {leader && (
        <>
          <PageHeader
            title={staffDisplayName(leader.staffProfile, t("profile.unnamed"))}
            subtitle={leader.title?.trim() || t("leaders.card.title")}
          />
          <FlipCard leader={cardLeader} trainerPositions={trainerPositions} />
        </>
      )}
    </div>
  );
}
