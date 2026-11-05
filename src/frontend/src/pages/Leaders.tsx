import { type LeaderSummary, Role } from "@/backend";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import {
  type CardEntry,
  FullProfileLink,
  RoadieCardModal,
} from "@/components/roadie/RoadieCardModal";
import { useI18n } from "@/hooks/useI18n";
import { useLeaders } from "@/hooks/useQueries";
import { refToDataUrl, staffDisplayName } from "@/lib/format";
import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

/** The three tier groups, in display order. */
type TierKey = "legend" | "plat" | "gold";

const TIERS: { key: TierKey; headingKey: string }[] = [
  { key: "legend", headingKey: "leaders.section.legend" },
  { key: "plat", headingKey: "leaders.section.plat" },
  { key: "gold", headingKey: "leaders.section.gold" },
];

/**
 * The role that decides a leader's tier: the role they stated on their staff
 * profile, falling back to their access-grant role. The store owner is
 * bootstrapped as an Admin, so their grant role alone would show them as a
 * Market Partner even when they told us they are a Store Manager.
 */
function tierRole(leader: LeaderSummary): Role {
  return leader.staffProfile?.requestedRole ?? leader.role;
}

/**
 * The tier a leader belongs to. Trainers are Gold; managers (store, training
 * and visiting) are Platinum; leadership and market partners are Legend. Any
 * other readable role falls back to Legend so no leader is ever dropped.
 */
function tierOf(leader: LeaderSummary): TierKey {
  switch (tierRole(leader)) {
    case Role.trainer:
      return "gold";
    case Role.storeManager:
    case Role.trainingManager:
    case Role.visitingManager:
      return "plat";
    default:
      return "legend";
  }
}

/** The tier ribbon label key for a leader, matching the card ribbon. */
function tierLabelKey(leader: LeaderSummary): string {
  switch (tierRole(leader)) {
    case Role.trainer:
      return "roadie.card.tier.gold";
    case Role.trainingManager:
      return "roadie.card.tier.plat.training";
    case Role.visitingManager:
      return "roadie.card.tier.plat.visiting";
    case Role.leadership:
      return "roadie.card.tier.legend.leadership";
    case Role.storeManager:
      return "roadie.card.tier.plat";
    default:
      return "roadie.card.tier.legend";
  }
}

/** A leader's initials for the no-photo placeholder, at most two letters. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/** One leader card in the grid; tapping it opens the shared card pop-up. */
function LeaderTile({
  leader,
  onOpen,
}: {
  leader: LeaderSummary;
  onOpen: () => void;
}) {
  const { t } = useI18n();
  const name = staffDisplayName(leader.staffProfile, t("profile.unnamed"));
  const title = leader.title?.trim() || t("roadie.field.none");
  // A stored photo always wins; a leader with no stored photo falls back to
  // their demo-only photo URL, which never touches real records.
  const photoUrl = useMemo(
    () =>
      refToDataUrl(leader.staffProfile?.photo) ?? leader.demoPhotoUrl ?? null,
    [leader.staffProfile?.photo, leader.demoPhotoUrl],
  );

  return (
    <li data-ocid="leaders.item">
      <button
        type="button"
        data-ocid="leaders.item.link"
        onClick={onOpen}
        className="group flex h-full w-full flex-col gap-3 rounded-lg border border-border bg-card p-4 text-left shadow-subtle transition-smooth hover:-translate-y-0.5 hover:shadow-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span
          className="inline-flex w-fit items-center rounded-full bg-primary px-3 py-1 font-display text-[11px] font-semibold uppercase tracking-wider text-primary-foreground"
          data-ocid="leaders.item.tier"
        >
          {t(tierLabelKey(leader))}
        </span>

        <div
          className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-primary bg-muted"
          data-ocid="leaders.item.photo"
        >
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={name}
              className="h-full w-full object-cover object-top"
            />
          ) : (
            <span
              className="font-display text-xl font-semibold uppercase tracking-wide text-muted-foreground"
              aria-hidden="true"
            >
              {initialsOf(name)}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-semibold uppercase tracking-wide text-foreground">
            {name}
          </p>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {title}
          </p>
        </div>

        <span className="flex items-center gap-1 font-display text-xs font-semibold uppercase tracking-wider text-primary">
          {t("leaders.viewCard")}
          <ChevronRight
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </span>
      </button>
    </li>
  );
}

export default function LeadersPage() {
  const { t } = useI18n();
  const { data: leaders, isLoading, isError, refetch } = useLeaders(true);
  const [card, setCard] = useState<{ tier: TierKey; index: number } | null>(
    null,
  );

  const grouped = useMemo(() => {
    const groups: Record<TierKey, LeaderSummary[]> = {
      legend: [],
      plat: [],
      gold: [],
    };
    for (const leader of leaders ?? []) {
      groups[tierOf(leader)].push(leader);
    }
    return groups;
  }, [leaders]);

  const entriesByTier = useMemo(() => {
    const map: Record<TierKey, CardEntry[]> = {
      legend: [],
      plat: [],
      gold: [],
    };
    for (const tier of TIERS) {
      map[tier.key] = grouped[tier.key].map((leader) => ({
        key: leader.principal.toString(),
        leader,
      }));
    }
    return map;
  }, [grouped]);

  const total = leaders?.length ?? 0;

  return (
    <div className="space-y-8" data-ocid="leaders.page">
      <PageHeader title={t("leaders.title")} subtitle={t("leaders.subtitle")} />

      {isLoading && <LoadingState label={t("leaders.loading")} />}
      {isError && (
        <ErrorState
          message={t("leaders.error")}
          onRetry={() => void refetch()}
        />
      )}

      {!isLoading && !isError && total === 0 && (
        <EmptyState title={t("leaders.empty")} />
      )}

      {!isLoading &&
        !isError &&
        TIERS.map((tier) => {
          const members = grouped[tier.key];
          if (members.length === 0) return null;
          return (
            <section
              key={tier.key}
              data-ocid={`leaders.section.${tier.key}`}
              aria-labelledby={`leaders-heading-${tier.key}`}
              className="space-y-4"
            >
              <div className="flex items-center gap-3">
                <h2
                  id={`leaders-heading-${tier.key}`}
                  className="font-display text-xl font-bold uppercase tracking-wide text-foreground"
                >
                  {t(tier.headingKey)}
                </h2>
                <span className="h-px flex-1 bg-border" aria-hidden="true" />
                <span className="text-sm text-muted-foreground">
                  {members.length}
                </span>
              </div>

              <ul
                className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                data-ocid={`leaders.list.${tier.key}`}
              >
                {members.map((leader, index) => (
                  <LeaderTile
                    key={leader.principal.toString()}
                    leader={leader}
                    onOpen={() => setCard({ tier: tier.key, index })}
                  />
                ))}
              </ul>
            </section>
          );
        })}

      <RoadieCardModal
        entries={card ? entriesByTier[card.tier] : []}
        index={card?.index ?? 0}
        open={card !== null}
        onOpenChange={(next) => {
          if (!next) setCard(null);
        }}
        onIndexChange={(index) =>
          setCard((current) => (current ? { ...current, index } : current))
        }
        renderFullProfile={(entry) => <FullProfileLink entry={entry} />}
      />
    </div>
  );
}
