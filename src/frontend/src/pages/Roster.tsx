import type { Roadie } from "@/backend";
import { RoadieStatus, RosterState } from "@/backend";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { useDashboardCopy } from "@/components/dashboard/copy";
import {
  type CardEntry,
  FullProfileLink,
  RoadieCardModal,
} from "@/components/roadie/RoadieCardModal";
import {
  RoadieTile,
  usePaperworkIncompleteMap,
} from "@/components/roadie/RoadieTile";
import { Input } from "@/components/ui/input";
import { canArchive, useAccessState } from "@/hooks/useAccess";
import { useCrews, usePositions, useRoadies } from "@/hooks/useQueries";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";

/** Which list the card pop-up is navigating within. */
type CardList = "pending" | "active" | "former";

/** The Pending / Active tab selection on the roster. */
type RosterTab = "pending" | "active";

export default function RosterPage() {
  const { t } = useDashboardCopy();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<RosterTab>("active");
  const [showFormer, setShowFormer] = useState(false);
  const [card, setCard] = useState<{ list: CardList; index: number } | null>(
    null,
  );
  const { data: roadies, isLoading, isError, refetch } = useRoadies();
  const { data: positions } = usePositions();
  const { data: crews } = useCrews();
  const access = useAccessState();
  const role = access.kind === "granted" ? access.grant.role : undefined;
  const mayOpenFullProfile = canArchive(role);

  const positionMap = useMemo(() => {
    const map = new Map<string, { name: string; code: string }>();
    for (const position of positions ?? []) {
      map.set(position.id.toString(), {
        name: position.name,
        code: position.code,
      });
    }
    return map;
  }, [positions]);

  const crewMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const crew of crews ?? []) {
      map.set(crew.id.toString(), crew.name);
    }
    return map;
  }, [crews]);

  const { pending, active, archived } = useMemo(() => {
    const list = roadies ?? [];
    const q = query.trim().toLowerCase();
    const matches = (roadie: Roadie) => {
      if (!q) return true;
      const name = (
        roadie.profile.preferredName || roadie.profile.name
      ).toLowerCase();
      const position = (
        positionMap.get(roadie.mainPositionId.toString())?.name ?? ""
      ).toLowerCase();
      return name.includes(q) || position.includes(q);
    };
    const live = list.filter(
      (roadie) => roadie.status !== RoadieStatus.archived && matches(roadie),
    );
    return {
      pending: live.filter(
        (roadie) => roadie.rosterState === RosterState.pending,
      ),
      active: live.filter(
        (roadie) => roadie.rosterState === RosterState.active,
      ),
      archived: list.filter(
        (roadie) => roadie.status === RoadieStatus.archived && matches(roadie),
      ),
    };
  }, [roadies, query, positionMap]);

  // The paperwork-overdue flag is computed from the orientation check-off,
  // which only Admin and Store Manager may read.
  const paperworkFlags = usePaperworkIncompleteMap(
    roadies ?? [],
    canArchive(role),
  );

  const shown = tab === "pending" ? pending : active;

  const shownEntries: CardEntry[] = useMemo(
    () => shown.map((roadie) => ({ key: roadie.id.toString(), roadie })),
    [shown],
  );
  const formerEntries: CardEntry[] = useMemo(
    () => archived.map((roadie) => ({ key: roadie.id.toString(), roadie })),
    [archived],
  );

  const positionNameOf = (roadie: Roadie) =>
    positionMap.get(roadie.mainPositionId.toString())?.name ??
    t("roadie.field.none");
  const crewNameOf = (roadie: Roadie) =>
    roadie.crewId === undefined
      ? undefined
      : crewMap.get(roadie.crewId.toString());

  const hasAny = pending.length > 0 || active.length > 0 || archived.length > 0;

  const tabs: { key: RosterTab; label: string; count: number }[] = [
    {
      key: "pending",
      label: t("roster.filter.pending"),
      count: pending.length,
    },
    { key: "active", label: t("roster.filter.active"), count: active.length },
  ];

  return (
    <div className="space-y-6" data-ocid="roster.page">
      <PageHeader title={t("roster.title")} subtitle={t("roster.subtitle")} />

      <div className="w-full sm:max-w-sm">
        <label htmlFor="roster-search" className="sr-only">
          {t("roster.search")}
        </label>
        <Input
          id="roster-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("roster.searchPlaceholder")}
          data-ocid="roster.search_input"
          className="touch-target"
        />
      </div>

      <div
        role="tablist"
        aria-label={t("roster.title")}
        className="flex flex-wrap gap-2"
        data-ocid="roster.tabs"
      >
        {tabs.map((entry) => {
          const selected = tab === entry.key;
          return (
            <button
              key={entry.key}
              type="button"
              role="tab"
              aria-selected={selected}
              data-ocid={`roster.filter.${entry.key}.tab`}
              onClick={() => setTab(entry.key)}
              className={cn(
                "touch-target inline-flex items-center gap-2 rounded-full border px-4 font-display text-sm font-semibold uppercase tracking-wider transition-smooth focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              {entry.label}
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] tabular-nums",
                  selected
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {entry.count}
              </span>
            </button>
          );
        })}
      </div>

      {isLoading && <LoadingState label={t("roster.loading")} />}
      {isError && (
        <ErrorState
          message={t("roster.error")}
          onRetry={() => void refetch()}
        />
      )}

      {!isLoading && !isError && !hasAny && (
        <EmptyState title={query ? t("roster.empty") : t("roster.emptyAll")} />
      )}

      {!isLoading && !isError && hasAny && shown.length === 0 && (
        <EmptyState
          title={
            tab === "pending"
              ? t("roster.emptyPending")
              : t("roster.emptyActive")
          }
        />
      )}

      {shown.length > 0 && (
        <ul
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
          data-ocid="roster.list"
        >
          {shown.map((roadie, index) => (
            <RoadieTile
              key={roadie.id.toString()}
              roadie={roadie}
              positionName={positionNameOf(roadie)}
              crewName={crewNameOf(roadie) ?? t("roadie.field.none")}
              crewLabel={t("roadie.field.crew")}
              paperworkIncomplete={paperworkFlags.get(roadie.id.toString())}
              onOpen={() => setCard({ list: tab, index })}
              ocid="roster.item"
              statusOcid="roster.item.status"
              photoOcid="roster.item.photo"
            />
          ))}
        </ul>
      )}

      {archived.length > 0 && (
        <section className="space-y-3" data-ocid="roster.former.section">
          <button
            type="button"
            className="touch-target flex w-full items-center justify-between rounded-md border border-border bg-card px-4 py-2 font-display text-sm font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:bg-muted"
            aria-expanded={showFormer}
            data-ocid="roster.former.toggle"
            onClick={() => setShowFormer((on) => !on)}
          >
            {showFormer
              ? t("dashboard.roster.hideFormer", { count: archived.length })
              : t("dashboard.roster.showFormer", { count: archived.length })}
            {showFormer ? (
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            )}
          </button>

          {showFormer && (
            <>
              <h2 className="font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">
                {t("dashboard.roster.formerTitle")}
              </h2>
              <ul
                className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
                data-ocid="roster.former.list"
              >
                {archived.map((roadie, index) => (
                  <RoadieTile
                    key={roadie.id.toString()}
                    roadie={roadie}
                    positionName={positionNameOf(roadie)}
                    onOpen={() => setCard({ list: "former", index })}
                    ocid="roster.former.item"
                    statusOcid="roster.former.item.status"
                    photoOcid="roster.former.item.photo"
                  />
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <RoadieCardModal
        entries={card?.list === "former" ? formerEntries : shownEntries}
        index={card?.index ?? 0}
        open={card !== null}
        onOpenChange={(next) => {
          if (!next) setCard(null);
        }}
        onIndexChange={(index) =>
          setCard((current) => (current ? { ...current, index } : current))
        }
        renderFullProfile={
          mayOpenFullProfile
            ? (entry) => <FullProfileLink entry={entry} />
            : undefined
        }
      />
    </div>
  );
}
