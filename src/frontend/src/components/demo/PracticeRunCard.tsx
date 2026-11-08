import {
  DemoRole,
  DemoShift,
  type EventId,
  EventKind,
  RoadieStage,
  Role,
  Shift,
} from "@/backend";
import { Button } from "@/components/ui/button";
import { useRealAccessGrant } from "@/hooks/useAccess";
import { useDemo } from "@/hooks/useDemo";
import { useI18n } from "@/hooks/useI18n";
import {
  useAbsentAlerts,
  useCheckInBoard,
  useCrews,
  useDemoDataLoadedAt,
  useDemoDataSummary,
  useRoadies,
  useSchedule,
  useSetDemoTrainerAs,
  useShiftBoard,
} from "@/hooks/useQueries";
import { dateToDateOnly, timestampToDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Principal } from "@icp-sdk/core/principal";
import { useNavigate } from "@tanstack/react-router";
import { Check, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

/**
 * The demo seed baselines the practice run compares against. The seed loads 3
 * pending kiosk sign-ups and 18 roadies already at Paperwork Done, so steps 1
 * and 2 count as done only once the Admin moves past those baselines. Steps 3-6
 * start from zero in the seed, so their thresholds are absolute.
 */
const SEED_PENDING_SIGNUPS = 3;
const SEED_PAPERWORK_DONE = 18;
const ORIENTED_TARGET = 10;

/** One practice-run step: its copy keys, done state and Take me there action. */
interface PracticeStep {
  id: number;
  titleKey: string;
  bodyKey: string;
  done: boolean;
  onTakeMeThere: () => void;
}

/** The first Training Day event's id and date, or null when none is scheduled. */
function firstTrainingDay(
  schedule: { id: EventId; kind: EventKind; start: bigint }[],
): { eventId: EventId; day: bigint } | null {
  const days = schedule
    .filter((event) => event.kind === EventKind.trainingDay)
    .sort((a, b) => Number(a.start - b.start));
  const first = days[0];
  if (!first) return null;
  const date = timestampToDate(first.start);
  if (!date) return null;
  return { eventId: first.id, day: dateToDateOnly(date) };
}

/** The demo Orientation event's date, or null when none is scheduled. */
function orientationDay(
  schedule: { kind: EventKind; start: bigint }[],
): bigint | null {
  const event = schedule.find((item) => item.kind === EventKind.orientation);
  if (!event) return null;
  const date = timestampToDate(event.start);
  return date ? dateToDateOnly(date) : null;
}

/**
 * The practice-run card body. Mounted only while demo mode is on and the caller
 * is the real Admin, so its demo-data reads never run on any other screen.
 */
function PracticeRunBody({ onHide }: { onHide: () => void }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const demo = useDemo();
  const setTrainerAs = useSetDemoTrainerAs();

  const summary = useDemoDataSummary(true);
  const roadies = useRoadies();
  const schedule = useSchedule();
  const crews = useCrews();
  const alerts = useAbsentAlerts(true);

  const trainingDay1 = useMemo(
    () => firstTrainingDay(schedule.data ?? []),
    [schedule.data],
  );
  const board = useShiftBoard(trainingDay1?.eventId, Shift.am, !!trainingDay1);
  const checkIn = useCheckInBoard(
    trainingDay1?.eventId,
    Shift.am,
    !!trainingDay1,
  );

  const demoRoadies = roadies.data ?? [];
  const pendingSignups = summary.data ? Number(summary.data.signups) : 0;
  const paperworkDone = demoRoadies.filter(
    (roadie) => roadie.stage === RoadieStage.paperworkDone,
  ).length;
  const oriented = demoRoadies.filter(
    (roadie) => roadie.stage === RoadieStage.oriented,
  ).length;

  const boardGroups = board.data?.groups ?? [];
  const boardHasGroup = boardGroups.some((group) => group.roadies.length > 0);
  const firstTrainer: Principal | undefined = boardGroups.find(
    (group) => group.roadies.length > 0,
  )?.trainerPrincipal;

  const checkedInIds = new Set(
    (checkIn.data?.roadies ?? [])
      .filter((row) => row.state !== undefined)
      .map((row) => row.roadieId.toString()),
  );
  const trainerGroup = boardGroups.find(
    (group) =>
      firstTrainer !== undefined &&
      group.trainerPrincipal.toString() === firstTrainer.toString(),
  );
  const trainerGroupCheckedIn =
    !!trainerGroup &&
    trainerGroup.roadies.length > 0 &&
    trainerGroup.roadies.every((roadie) =>
      checkedInIds.has(roadie.roadieId.toString()),
    );

  const alertHandled = (alerts.data ?? []).some(
    (alert) => alert.excused !== undefined || alert.archived,
  );

  // The crew owner of the first absent roadie, for step 6's Manager picker.
  const absentCrewOwner = useMemo<Principal | undefined>(() => {
    const alert = (alerts.data ?? [])[0];
    if (!alert) return undefined;
    const roadie = demoRoadies.find(
      (candidate) => candidate.id.toString() === alert.roadieId.toString(),
    );
    if (!roadie?.crewId) return undefined;
    const crew = (crews.data ?? []).find(
      (candidate) => candidate.id.toString() === roadie.crewId?.toString(),
    );
    return crew?.leaderPrincipal;
  }, [alerts.data, demoRoadies, crews.data]);

  const orientationDate = useMemo(
    () => orientationDay(schedule.data ?? []),
    [schedule.data],
  );

  const steps: PracticeStep[] = [
    {
      id: 1,
      titleKey: "today.practice.step1.title",
      bodyKey: "today.practice.step1.body",
      done: pendingSignups < SEED_PENDING_SIGNUPS,
      onTakeMeThere: () => {
        demo.setRole(DemoRole.admin, []);
        demo.setPretendDate(null);
        void navigate({ to: "/approvals" });
      },
    },
    {
      id: 2,
      titleKey: "today.practice.step2.title",
      bodyKey: "today.practice.step2.body",
      done: paperworkDone > SEED_PAPERWORK_DONE,
      onTakeMeThere: () => {
        demo.setRole(DemoRole.admin, []);
        void navigate({ to: "/roster", search: { tab: "hired" } });
      },
    },
    {
      id: 3,
      titleKey: "today.practice.step3.title",
      bodyKey: "today.practice.step3.body",
      done: oriented >= ORIENTED_TARGET,
      onTakeMeThere: () => {
        if (orientationDate !== null) {
          demo.setPretendDate({ day: orientationDate, shift: DemoShift.am });
        }
        demo.setRole(DemoRole.admin, []);
        void navigate({ to: "/orientation" });
      },
    },
    {
      id: 4,
      titleKey: "today.practice.step4.title",
      bodyKey: "today.practice.step4.body",
      done: boardHasGroup,
      onTakeMeThere: () => {
        if (trainingDay1) {
          demo.setPretendDate({ day: trainingDay1.day, shift: DemoShift.am });
        }
        demo.setRole(DemoRole.admin, []);
        void navigate({ to: "/groups" });
      },
    },
    {
      id: 5,
      titleKey: "today.practice.step5.title",
      bodyKey: "today.practice.step5.body",
      done: trainerGroupCheckedIn,
      onTakeMeThere: () => {
        if (trainingDay1) {
          demo.setPretendDate({ day: trainingDay1.day, shift: DemoShift.am });
        }
        demo.setRole(DemoRole.trainer, []);
        if (firstTrainer) setTrainerAs.mutate(firstTrainer);
        void navigate({ to: "/today" });
      },
    },
    {
      id: 6,
      titleKey: "today.practice.step6.title",
      bodyKey: "today.practice.step6.body",
      done: alertHandled,
      onTakeMeThere: () => {
        if (trainingDay1) {
          demo.setPretendDate({ day: trainingDay1.day, shift: DemoShift.am });
        }
        demo.setRole(DemoRole.storeManager, []);
        if (absentCrewOwner) demo.setManagerAs(absentCrewOwner);
        void navigate({ to: "/today" });
      },
    },
  ];

  const firstNotDone = steps.find((step) => !step.done);
  const allDone = !firstNotDone;

  return (
    <section
      data-ocid="today.practice.card"
      aria-label={t("today.practice.title")}
      className="rounded-lg border border-primary/40 bg-card p-5 shadow-subtle"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold uppercase tracking-wide text-foreground">
            {t("today.practice.title")}
          </h2>
          <p
            data-ocid="today.practice.progress"
            className="mt-1 text-sm font-medium text-muted-foreground"
          >
            {allDone
              ? t("today.practice.complete")
              : t("today.practice.progress", {
                  step: firstNotDone?.id ?? steps.length,
                  total: steps.length,
                })}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-ocid="today.practice.hide_button"
          className="touch-target shrink-0"
          onClick={onHide}
        >
          {t("today.practice.hide")}
        </Button>
      </div>

      <ol className="mt-4 space-y-2" data-ocid="today.practice.list">
        {steps.map((step) => (
          <li
            key={step.id}
            data-ocid={`today.practice.step.${step.id}`}
            className={cn(
              "flex flex-wrap items-start gap-3 rounded-md border p-3",
              step.done
                ? "border-border bg-muted/30"
                : step.id === firstNotDone?.id
                  ? "border-primary/50 bg-primary/5"
                  : "border-border bg-card",
            )}
          >
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold",
                step.done
                  ? "bg-[oklch(0.62_0.17_150)] text-white"
                  : "bg-muted text-muted-foreground",
              )}
              aria-hidden="true"
            >
              {step.done ? <Check className="h-4 w-4" /> : step.id}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-semibold uppercase tracking-wide text-foreground">
                {t(step.titleKey)}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t(step.bodyKey)}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-ocid={`today.practice.step.${step.id}.take_me_there_button`}
              className="touch-target shrink-0"
              onClick={step.onTakeMeThere}
            >
              {t("today.practice.takeMeThere")}
              <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * The demo-mode-only "Practice run" card at the top of Today. Shown only to the
 * real Admin while demo mode is on, regardless of the current View as role. Each
 * step's done state is derived from the demo data, never from a manual tick, and
 * "Take me there" drives the existing demo setters before navigating.
 *
 * The card body is mounted only while it is actually shown, so none of its
 * demo-data reads run when demo mode is off or for a non-Admin caller.
 */
export function PracticeRunCard() {
  const demo = useDemo();
  const realGrant = useRealAccessGrant();
  const loadedAt = useDemoDataLoadedAt();

  // The card is hidden for the current session only. Loading demo data resets
  // the hidden flag, so the card reappears and progress restarts at step 1.
  // The reset is keyed to the Load demo data action itself (a marker bumped on
  // every load), not to the demo record counts, because the seed is idempotent
  // and a redundant load leaves the counts unchanged.
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (loadedAt > 0) setHidden(false);
  }, [loadedAt]);

  const isRealAdmin = realGrant?.role === Role.admin;
  if (!demo.enabled || !isRealAdmin || hidden) return null;

  return <PracticeRunBody onHide={() => setHidden(true)} />;
}
