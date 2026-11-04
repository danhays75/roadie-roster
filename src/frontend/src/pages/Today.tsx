import type { GroupChangeNotice, Roadie, ShiftBoardRoadie } from "@/backend";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { useDashboardCopy } from "@/components/dashboard/copy";
import {
  type CardEntry,
  RoadieCardModal,
} from "@/components/roadie/RoadieCardModal";
import { RoadiePhoto } from "@/components/roadie/RoadiePhoto";
import { Button } from "@/components/ui/button";
import { canGroups, useAccessState } from "@/hooks/useAccess";
import {
  useDismissGroupChangeNotice,
  useGroupChangeNotices,
  useMyGroup,
  useRoadies,
} from "@/hooks/useQueries";
import { Link } from "@tanstack/react-router";
import { BellRing, Loader2, Users, X } from "lucide-react";
import { useMemo, useState } from "react";

/**
 * One dismissible "Your group changed" notice: the shift label, the added and
 * removed roadie names and the editor's name, with a Dismiss action that hides
 * it for the signed-in trainer.
 */
function GroupChangeNoticeCard({ notice }: { notice: GroupChangeNotice }) {
  const { t } = useDashboardCopy();
  const dismiss = useDismissGroupChangeNotice();
  const [error, setError] = useState<string | null>(null);

  return (
    <section
      data-ocid="today.notice.card"
      aria-label={t("groups.notice.title")}
      className="rounded-lg border border-primary/40 bg-primary/5 p-4 shadow-subtle"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <BellRing className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-sm font-bold uppercase tracking-widest text-foreground">
              {t("groups.notice.title")}
            </h2>
            <span
              data-ocid="today.notice.shift"
              className="inline-flex items-center rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
            >
              {notice.shiftLabel}
            </span>
          </div>
          {notice.addedNames.length > 0 && (
            <p
              data-ocid="today.notice.added"
              className="mt-2 text-sm text-foreground"
            >
              {t("groups.notice.added", {
                names: notice.addedNames.join(", "),
              })}
            </p>
          )}
          {notice.removedNames.length > 0 && (
            <p
              data-ocid="today.notice.removed"
              className="mt-1 text-sm text-foreground"
            >
              {t("groups.notice.removed", {
                names: notice.removedNames.join(", "),
              })}
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {t("groups.notice.by", { name: notice.editorName })}
          </p>
          {error && (
            <p className="mt-1 text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="touch-target shrink-0"
          aria-label={t("groups.notice.dismiss")}
          data-ocid="today.notice.dismiss_button"
          disabled={dismiss.isPending}
          onClick={() => {
            setError(null);
            dismiss.mutate(notice.id, {
              onError: (err) =>
                setError(
                  err instanceof Error
                    ? err.message
                    : t("groups.notice.dismissError"),
                ),
            });
          }}
        >
          {dismiss.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <X className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </div>
    </section>
  );
}

/** One roadie in the trainer's group: photo and name, tappable to open the card. */
function GroupRoadieCard({
  roadie,
  index,
  onOpen,
}: {
  roadie: ShiftBoardRoadie;
  index: number;
  onOpen: () => void;
}) {
  return (
    <li data-ocid={`today.myGroup.item.${index}`} className="h-full">
      <button
        type="button"
        data-ocid={`today.myGroup.item.${index}.link`}
        onClick={onOpen}
        className="group flex h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-card text-left shadow-subtle transition-smooth hover:-translate-y-0.5 hover:shadow-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <RoadiePhoto
          id={roadie.roadieId}
          name={roadie.name}
          className="aspect-[4/3] w-full rounded-none border-0 border-b-2 border-primary"
          iconClassName="h-8 w-8"
          ocid={`today.myGroup.item.${index}.photo`}
          fallback={
            <span
              className="flex h-full w-full items-center justify-center font-display text-2xl font-bold uppercase tracking-wide text-[#14284B]"
              aria-hidden="true"
            >
              {roadie.name.slice(0, 2).toUpperCase()}
            </span>
          }
        />
        <span className="flex min-w-0 flex-1 flex-col gap-1 p-3">
          <span className="truncate font-display text-sm font-semibold uppercase tracking-wide text-foreground">
            {roadie.name}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {roadie.positionCode}
          </span>
        </span>
      </button>
    </li>
  );
}

/**
 * The trainer's own group for the current or next shift: the shift label, the
 * filled-of-capacity count, the roadies' photos and names, and a link to all
 * groups. Tapping a roadie opens the shared card pop-up. Renders nothing when
 * the caller trains no group on that shift.
 */
function MyGroupSection() {
  const { t } = useDashboardCopy();
  const { data: group } = useMyGroup();
  const { data: allRoadies } = useRoadies();
  const [cardIndex, setCardIndex] = useState<number | null>(null);

  const roadieById = useMemo(() => {
    const map = new Map<string, Roadie>();
    for (const roadie of allRoadies ?? []) {
      map.set(roadie.id.toString(), roadie);
    }
    return map;
  }, [allRoadies]);

  const groupRoadies = group?.roadies ?? [];
  const entries: CardEntry[] = useMemo(() => {
    const list: CardEntry[] = [];
    for (const boardRoadie of groupRoadies) {
      const roadie = roadieById.get(boardRoadie.roadieId.toString());
      if (roadie) list.push({ key: roadie.id.toString(), roadie });
    }
    return list;
  }, [groupRoadies, roadieById]);

  // Map each board roadie to its position in `entries`, so a card opens the
  // matching entry even if a roadie is missing from the visible list.
  const entryIndexById = useMemo(() => {
    const map = new Map<string, number>();
    entries.forEach((entry, index) => map.set(entry.key, index));
    return map;
  }, [entries]);

  if (!group) return null;

  return (
    <section className="space-y-4" data-ocid="today.myGroup.section">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide text-foreground">
            {t("today.myGroup.shift", { shift: group.shiftLabel })}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("today.myGroup.capacity", {
              count: groupRoadies.length,
              capacity: Number(group.capacity),
            })}
          </p>
        </div>
        <Button asChild variant="outline" className="touch-target">
          <Link to="/groups" data-ocid="today.myGroup.view_all_link">
            <Users className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("today.myGroup.viewAll")}
          </Link>
        </Button>
      </div>

      {groupRoadies.length === 0 ? (
        <EmptyState
          title={t("today.myGroup.empty")}
          ocid="today.myGroup.empty_state"
        />
      ) : (
        <ul
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
          data-ocid="today.myGroup.list"
        >
          {groupRoadies.map((roadie, index) => (
            <GroupRoadieCard
              key={roadie.roadieId.toString()}
              roadie={roadie}
              index={index}
              onOpen={() =>
                setCardIndex(
                  entryIndexById.get(roadie.roadieId.toString()) ?? null,
                )
              }
            />
          ))}
        </ul>
      )}

      <RoadieCardModal
        entries={entries}
        index={cardIndex ?? 0}
        open={cardIndex !== null}
        onOpenChange={(next) => {
          if (!next) setCardIndex(null);
        }}
        onIndexChange={setCardIndex}
      />
    </section>
  );
}

/**
 * The trainer-facing Today content: the undismissed "Your group changed"
 * notices at the top, then the caller's own group for the current or next
 * shift. Only mounted for roles that may read the shift boards, so the group
 * and notice reads never run for a role the backend would reject.
 */
function TrainerToday() {
  const { t } = useDashboardCopy();
  const { data: group, isLoading, isError, refetch } = useMyGroup();
  const { data: notices } = useGroupChangeNotices();

  return (
    <>
      {(notices ?? []).map((notice) => (
        <GroupChangeNoticeCard key={notice.id.toString()} notice={notice} />
      ))}

      {isLoading && (
        <LoadingState
          label={t("today.myGroup.loading")}
          ocid="today.myGroup.loading_state"
        />
      )}

      {isError && (
        <ErrorState
          message={t("today.myGroup.error")}
          onRetry={() => void refetch()}
          ocid="today.myGroup.error_state"
        />
      )}

      {!isLoading && !isError && group && <MyGroupSection />}

      {!isLoading && !isError && !group && (
        <section
          data-ocid="today.placeholder"
          className="rounded-lg border border-dashed border-border bg-card p-8 text-center"
        >
          <h2 className="font-display text-xl font-semibold uppercase tracking-wide">
            {t("today.placeholder.title")}
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            {t("today.placeholder.body")}
          </p>
        </section>
      )}
    </>
  );
}

/**
 * The Today page. A trainer sees their own group for the current or next shift
 * with their roadies' photos and names, plus any undismissed "Your group
 * changed" notices at the top. Every other role, and a trainer with no group,
 * sees the existing placeholder content.
 */
export default function TodayPage() {
  const { t } = useDashboardCopy();
  const access = useAccessState();
  const role = access.kind === "granted" ? access.grant.role : undefined;
  const mayViewGroups = canGroups(role);

  return (
    <div className="space-y-6" data-ocid="today.page">
      <PageHeader title={t("today.title")} subtitle={t("app.tagline")} />

      {mayViewGroups ? (
        <TrainerToday />
      ) : (
        <section
          data-ocid="today.placeholder"
          className="rounded-lg border border-dashed border-border bg-card p-8 text-center"
        >
          <h2 className="font-display text-xl font-semibold uppercase tracking-wide">
            {t("today.placeholder.title")}
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            {t("today.placeholder.body")}
          </p>
        </section>
      )}
    </div>
  );
}
