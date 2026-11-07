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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { canArchive, useAccessState } from "@/hooks/useAccess";
import { useI18n } from "@/hooks/useI18n";
import {
  useCrews,
  useMyCrew,
  usePositions,
  useRoadies,
} from "@/hooks/useQueries";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Users } from "lucide-react";
import { useMemo, useState } from "react";

/** Which list the card pop-up is navigating within. */
type CardList = "all" | "pending" | "active" | "former";

/** The All / Pending / Active tab selection on the roster. */
type RosterTab = "all" | "pending" | "active";

/**
 * The crew filter selection. `"all"` shows every crew, `"none"` shows roadies
 * with no crew, and any other value is a crew id as a string.
 */
type CrewFilter = "all" | "none" | string;

export default function RosterPage() {
  const { t } = useDashboardCopy();
  const { locale } = useI18n();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<RosterTab>("all");
  const [crewFilter, setCrewFilter] = useState<CrewFilter>("all");
  const [showFormer, setShowFormer] = useState(false);
  const [card, setCard] = useState<{ list: CardList; index: number } | null>(
    null,
  );
  const { data: roadies, isLoading, isError, refetch } = useRoadies();
  const { data: positions } = usePositions();
  const { data: crews } = useCrews();
  const { data: myCrew } = useMyCrew();
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

  // The crews offered in the filter, sorted by name for a stable menu.
  const crewOptions = useMemo(
    () => [...(crews ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [crews],
  );

  // The caller's owned crew id as a string, or null when they own no crew.
  const myCrewId = myCrew ? myCrew.crewId.toString() : null;

  // A selected crew that no longer exists falls back to showing everyone.
  const activeCrewFilter: CrewFilter =
    crewFilter !== "all" && crewFilter !== "none" && !crewMap.has(crewFilter)
      ? "all"
      : crewFilter;

  const { pending, active, archived } = useMemo(() => {
    const list = roadies ?? [];
    const q = query.trim().toLowerCase();
    const matchesCrew = (roadie: Roadie) => {
      if (activeCrewFilter === "all") return true;
      if (activeCrewFilter === "none") return roadie.crewId === undefined;
      return roadie.crewId?.toString() === activeCrewFilter;
    };
    const matches = (roadie: Roadie) => {
      if (!matchesCrew(roadie)) return false;
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
  }, [roadies, query, positionMap, activeCrewFilter]);

  // The paperwork-overdue flag is computed from the orientation check-off,
  // which only Admin and Store Manager may read.
  const paperworkFlags = usePaperworkIncompleteMap(
    roadies ?? [],
    canArchive(role),
  );

  const shown =
    tab === "pending"
      ? pending
      : tab === "active"
        ? active
        : [...pending, ...active];

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
      key: "all",
      label: t("roster.filter.all"),
      count: pending.length + active.length,
    },
    {
      key: "pending",
      label: t("roster.filter.pending"),
      count: pending.length,
    },
    { key: "active", label: t("roster.filter.active"), count: active.length },
  ];

  const crewLabel = locale === "es" ? "Cuadrilla" : "Crew";
  const allCrewsLabel = locale === "es" ? "Todas las cuadrillas" : "All crews";
  const noCrewLabel = locale === "es" ? "Sin cuadrilla" : "No crew";
  const myCrewLabel = locale === "es" ? "Mi cuadrilla" : "My crew";

  return (
    <div className="space-y-6" data-ocid="roster.page">
      <PageHeader title={t("roster.title")} subtitle={t("roster.subtitle")} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
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

        <div className="w-full sm:w-56">
          <Select
            value={activeCrewFilter}
            onValueChange={(value) => setCrewFilter(value as CrewFilter)}
          >
            <SelectTrigger
              id="roster-crew-filter"
              aria-label={crewLabel}
              data-ocid="roster.crew.select"
              className="touch-target w-full"
            >
              <SelectValue placeholder={allCrewsLabel} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" data-ocid="roster.crew.all.option">
                {allCrewsLabel}
              </SelectItem>
              {crewOptions.map((crew) => (
                <SelectItem
                  key={crew.id.toString()}
                  value={crew.id.toString()}
                  data-ocid="roster.crew.option"
                >
                  {crew.name}
                </SelectItem>
              ))}
              <SelectItem value="none" data-ocid="roster.crew.none.option">
                {noCrewLabel}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {myCrewId && (
          <button
            type="button"
            aria-pressed={activeCrewFilter === myCrewId}
            data-ocid="roster.crew.my_crew.toggle"
            onClick={() =>
              setCrewFilter((current) =>
                current === myCrewId ? "all" : myCrewId,
              )
            }
            className={cn(
              "touch-target inline-flex items-center gap-2 self-start rounded-full border px-4 font-display text-sm font-semibold uppercase tracking-wider transition-smooth focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:self-end",
              activeCrewFilter === myCrewId
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            <Users className="h-4 w-4" aria-hidden="true" />
            {myCrewLabel}
          </button>
        )}
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
              : tab === "active"
                ? t("roster.emptyActive")
                : t("roster.emptyAll")
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
              rosterStateLabel={
                tab === "all"
                  ? roadie.rosterState === RosterState.pending
                    ? t("roster.filter.pending")
                    : t("roster.filter.active")
                  : undefined
              }
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
