import {
  type ApprovalDecision,
  type CrewSummary,
  type DateOnly,
  type DuplicateMatch,
  EventKind,
  type Position,
  type ScheduleEvent,
  type SignupId,
  type SignupSubmission,
  createActor,
} from "@/backend";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { StatusBadge } from "@/components/StatusBadge";
import { RejectConfirmDialog } from "@/components/approvals/ApprovalConfirmDialog";
import { ManagerSignaturePad } from "@/components/approvals/ManagerSignaturePad";
import { PendingApprovalList } from "@/components/approvals/PendingApprovalList";
import {
  DEFAULT_TIME_ZONE,
  calendarInTimeZone,
} from "@/components/approvals/timeZone";
import { RoadiePhoto } from "@/components/roadie/RoadiePhoto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { canAdmin, useAccessState } from "@/hooks/useAccess";
import { useI18n } from "@/hooks/useI18n";
import {
  useApproveSignup,
  useCrewSummaries,
  usePendingSignups,
  usePendingUsers,
  usePositions,
  useRejectSignup,
  useSchedule,
  useSignupDuplicates,
  useStoreInfo,
} from "@/hooks/useQueries";
import {
  dateOnlyToDate,
  dateToDateOnly,
  formatDateOnly,
  formatTimestamp,
  refToDataUrl,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { useActor } from "@caffeineai/core-infrastructure";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Check, UserCheck, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * A pending kiosk sign-up's photo bytes, read on demand by sign-up id. The
 * sign-up record carries no demo photo URL, so the kiosk photo is fetched by id
 * and the card falls back to the applicant's initials when it is absent. React
 * Query caches the result under the sign-up id, and the bytes never change for
 * a given id, so a re-render reuses the cached read.
 */
function useSignupPhoto(id: SignupId | undefined) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["signupPhoto", id?.toString()],
    queryFn: async () => {
      if (!actor || id === undefined) return null;
      return actor.getSignupPhoto(id);
    },
    enabled: !!actor && !isFetching && id !== undefined,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/** The applicant's initials for the no-photo placeholder, at most two letters. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/**
 * A pending sign-up's photo, read by sign-up id and shown at the top of the
 * card. The stored kiosk photo wins; when none was captured, a demo sign-up's
 * demo-only photo URL is shown; otherwise the applicant's initials in navy on
 * cream. Demo URLs never touch real records.
 */
function SignupPhoto({
  id,
  name,
  demoPhotoUrl,
  className,
  ocid,
}: {
  id: SignupId;
  name: string;
  /** A demo-only photo URL, used only when no kiosk photo was stored. */
  demoPhotoUrl?: string;
  className?: string;
  ocid?: string;
}) {
  const { data: photo } = useSignupPhoto(id);
  const storedSrc = useMemo(() => refToDataUrl(photo), [photo]);
  const src = storedSrc ?? demoPhotoUrl ?? null;

  return (
    <span
      data-ocid={ocid}
      className={cn(
        "flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-primary bg-[#F5F3EE]",
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          className="h-full w-full object-cover object-top"
        />
      ) : (
        <span
          className="font-display text-2xl font-bold uppercase tracking-wide text-[#14284B]"
          aria-hidden="true"
        >
          {initialsOf(name)}
        </span>
      )}
    </span>
  );
}

/** The orientation sessions that have not yet passed, soonest first. */
function upcomingOrientations(schedule: ScheduleEvent[]): ScheduleEvent[] {
  const now = Date.now();
  return schedule
    .filter((event) => event.kind === EventKind.orientation)
    .filter((event) => Number(event.start / 1_000_000n) >= now)
    .sort((a, b) => Number(a.start - b.start));
}

/**
 * The default orientation session: the next upcoming session, soonest first.
 * Sessions are already filtered to the future and sorted, so the first one is
 * the next session regardless of the applicant's house.
 */
function defaultOrientationId(sessions: ScheduleEvent[]): string {
  const next = sessions[0];
  return next ? next.id.toString() : "";
}

/**
 * The applicant's real age in the store's time zone, or null when the date of
 * birth is missing or invalid.
 */
function ageInTimeZone(dateOfBirth: DateOnly, timeZone: string): number | null {
  const birth = dateOnlyToDate(dateOfBirth);
  if (!birth) return null;
  const today = calendarInTimeZone(new Date(), timeZone);
  const birthYear = birth.getUTCFullYear();
  const birthMonth = birth.getUTCMonth() + 1;
  const birthDay = birth.getUTCDate();
  let age = today.year - birthYear;
  if (
    today.month < birthMonth ||
    (today.month === birthMonth && today.day < birthDay)
  ) {
    age -= 1;
  }
  return age;
}

/**
 * Radix Select forbids an empty-string item value, so "No crew" uses this
 * sentinel and is mapped back to an empty selection on change and submit.
 */
const NO_CREW = "__none__";

/**
 * Normalize a position name for matching: trim surrounding whitespace, lower
 * case, and drop a single trailing "s" so "Cashiers" matches "Cashier".
 */
function normalizePositionName(name: string): string {
  const trimmed = name.trim().toLowerCase();
  return trimmed.endsWith("s") ? trimmed.slice(0, -1) : trimmed;
}

/**
 * The position whose name matches the applicant's Position applied for,
 * ignoring case, surrounding whitespace and a single trailing "s" on either
 * side. Returns undefined when there is no applied-for value or no match.
 */
function matchAppliedPosition(
  appliedFor: string | undefined,
  positions: Position[],
): Position | undefined {
  if (!appliedFor) return undefined;
  const target = normalizePositionName(appliedFor);
  if (!target) return undefined;
  return positions.find(
    (position) => normalizePositionName(position.name) === target,
  );
}

/** The copy key describing what a duplicate matched on. */
function matchFieldKey(matchedOn: string): string {
  if (matchedOn === "both") return "approvals.signup.duplicates.match.both";
  if (matchedOn === "email") return "approvals.signup.duplicates.match.email";
  return "approvals.signup.duplicates.match.phone";
}

/** A compact list of duplicate matches found against all cards. */
function DuplicateList({ matches }: { matches: DuplicateMatch[] }) {
  const { t } = useI18n();
  if (matches.length === 0) {
    return (
      <p
        data-ocid="approvals.signup.duplicates.none"
        className="flex items-center gap-2 text-sm text-muted-foreground"
      >
        <Check className="h-4 w-4 text-accent" aria-hidden="true" />
        {t("approvals.signup.duplicates.none")}
      </p>
    );
  }
  return (
    <div
      data-ocid="approvals.signup.duplicates.list"
      className="rounded-md border border-destructive/30 bg-destructive/5 p-3"
    >
      <p className="flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-widest text-destructive">
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        {t("approvals.signup.duplicates.title")}
      </p>
      <ul className="mt-2 space-y-1 text-sm text-foreground">
        {matches.map((match) => (
          <li key={`${match.roadieId}-${match.matchedOn}`}>
            <Link
              to="/roster/$roadieId"
              params={{ roadieId: match.roadieId.toString() }}
              data-ocid="approvals.signup.duplicates.link"
              className="inline-flex min-h-[44px] flex-wrap items-center gap-x-1.5 rounded-sm text-foreground underline decoration-dotted underline-offset-4 transition-smooth hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RoadiePhoto
                id={match.roadieId}
                name={match.name}
                demoPhotoUrl={match.demoPhotoUrl}
                ocid="approvals.signup.duplicates.photo"
                className="h-9 w-9 border"
                iconClassName="h-4 w-4"
                fallback={
                  <span
                    className="font-display text-xs font-bold uppercase tracking-wide text-[#14284B]"
                    aria-hidden="true"
                  >
                    {initialsOf(match.name)}
                  </span>
                }
              />
              <span>
                {t("approvals.signup.duplicates.row", {
                  name: match.name,
                  position: match.mainPositionName,
                  field: t(matchFieldKey(match.matchedOn)),
                })}
              </span>
              {match.archived && (
                <span className="text-xs text-muted-foreground">
                  {t("roster.archived")}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * One pending kiosk submission under review: duplicate check, position, crew,
 * orientation session, start date, and the manager's drawn signature.
 */
function PendingSignupCard({
  signup,
  positions,
  crews,
  sessions,
  timeZone,
}: {
  signup: SignupSubmission;
  positions: Position[];
  crews: CrewSummary[];
  sessions: ScheduleEvent[];
  timeZone: string;
}) {
  const { t } = useI18n();
  const { data: duplicates, isLoading: duplicatesLoading } =
    useSignupDuplicates(signup.id);
  const approve = useApproveSignup();
  const reject = useRejectSignup();

  // The crew with the fewest roadies (pending + active, archived excluded) is
  // the default selection, so new hires spread across crews evenly.
  const fewestCrewId = useMemo(() => {
    if (crews.length === 0) return "";
    const fewest = crews.reduce((best, crew) =>
      crew.roadieCount < best.roadieCount ? crew : best,
    );
    return fewest.id.toString();
  }, [crews]);

  const [mainPositionId, setMainPositionId] = useState("");
  const [secondPositionId, setSecondPositionId] = useState("");
  const [crewId, setCrewId] = useState("");
  const [crewTouched, setCrewTouched] = useState(false);
  const [orientationId, setOrientationId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startDateTouched, setStartDateTouched] = useState(false);
  const [signature, setSignature] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);

  // Pre-select the crew with the fewest roadies once the crews load, unless the
  // manager has already chosen a crew themselves.
  useEffect(() => {
    if (!crewTouched && fewestCrewId) setCrewId(fewestCrewId);
  }, [crewTouched, fewestCrewId]);

  // Prefill Main position from the applicant's Position applied for once the
  // positions load, matching case-insensitively, trimming whitespace and
  // ignoring a single trailing "s". Runs only on first load so a later
  // positions refetch never overwrites the manager's own selection.
  const mainPrefilled = useRef(false);
  useEffect(() => {
    if (mainPrefilled.current) return;
    const match = matchAppliedPosition(
      signup.profile.positionAppliedFor,
      positions,
    );
    if (!match) return;
    mainPrefilled.current = true;
    setMainPositionId(match.id.toString());
  }, [signup.profile.positionAppliedFor, positions]);

  const mainPosition = positions.find(
    (position) => position.id.toString() === mainPositionId,
  );
  const secondPosition = positions.find(
    (position) => position.id.toString() === secondPositionId,
  );
  const suggestedOrientation = defaultOrientationId(sessions);

  // The session the manager is currently working with: their explicit choice,
  // or the suggested next session when they have not picked one.
  const selectedOrientationId = orientationId || suggestedOrientation;

  // Prefill Start date with the selected session's store-local calendar date,
  // and keep it in step when the manager switches sessions — unless they have
  // edited Start date by hand, in which case their value is never overwritten.
  useEffect(() => {
    if (startDateTouched) return;
    const session = sessions.find(
      (event) => event.id.toString() === selectedOrientationId,
    );
    if (!session) return;
    const { year, month, day } = calendarInTimeZone(
      new Date(Number(session.start / 1_000_000n)),
      timeZone,
    );
    const next = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setStartDate(next);
  }, [startDateTouched, selectedOrientationId, sessions, timeZone]);

  const age = useMemo(
    () => ageInTimeZone(signup.contactSet.dateOfBirth, timeZone),
    [signup.contactSet.dateOfBirth, timeZone],
  );

  const isMinor = age !== null && age < 18;

  const ageBlocked = useMemo(() => {
    if (age === null) return false;
    const realAge = BigInt(age);
    const mainTooYoung = !!mainPosition && realAge < mainPosition.minimumAge;
    const secondTooYoung =
      !!secondPosition && realAge < secondPosition.minimumAge;
    return mainTooYoung || secondTooYoung;
  }, [age, mainPosition, secondPosition]);

  const submit = () => {
    if (!mainPositionId) {
      setError(t("approvals.signup.main.required"));
      return;
    }
    if (ageBlocked) {
      setError(t("approvals.signup.minor.blocked"));
      return;
    }
    if (!signature || signature.length === 0) {
      setError(t("approvals.signup.signature.required"));
      return;
    }
    setError(null);
    const chosenOrientation = orientationId || suggestedOrientation;
    const decision: ApprovalDecision = {
      mainPositionId: BigInt(mainPositionId),
      secondPositionId: secondPositionId ? BigInt(secondPositionId) : undefined,
      crewId: crewId ? BigInt(crewId) : undefined,
      orientationEventId: chosenOrientation
        ? BigInt(chosenOrientation)
        : undefined,
      startDate: startDate
        ? dateToDateOnly(new Date(`${startDate}T00:00:00Z`))
        : undefined,
    };
    approve.mutate(
      {
        id: signup.id,
        decision,
        signature,
      },
      {
        onSuccess: () => {
          setMainPositionId("");
          setSecondPositionId("");
          setCrewId("");
          setCrewTouched(false);
          setOrientationId("");
          setStartDate("");
          setStartDateTouched(false);
          setSignature(null);
        },
        onError: () => setError(t("approvals.signup.approve.error")),
      },
    );
  };

  const confirmReject = () => {
    reject.mutate(signup.id, {
      onSuccess: () => setRejectOpen(false),
      onError: () => {
        setRejectOpen(false);
        setError(t("approvals.signup.approve.error"));
      },
    });
  };

  const name = signup.profile.preferredName || signup.profile.name;
  const key = signup.id.toString();

  return (
    <li
      data-ocid="approvals.signup.item"
      className="rounded-lg border border-border bg-card p-4 shadow-subtle"
    >
      <div className="flex flex-wrap items-start gap-3">
        <SignupPhoto
          id={signup.id}
          name={name}
          demoPhotoUrl={signup.demoPhotoUrl}
          ocid="approvals.signup.photo"
        />
        <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold uppercase tracking-wide">
              {name}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("approvals.signup.submittedAt")}:{" "}
              {formatTimestamp(signup.submittedAt, timeZone)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isMinor && (
              <StatusBadge tone="pending" ocid="approvals.signup.minor_badge">
                {t("roadie.minor")}
              </StatusBadge>
            )}
            <StatusBadge tone="muted">
              {t("approvals.signup.pending")}
            </StatusBadge>
          </div>
        </div>
      </div>

      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("roadie.field.phone")}
          </dt>
          <dd>{signup.contactSet.phone}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("roadie.field.email")}
          </dt>
          <dd className="break-all">{signup.contactSet.email}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("roadie.field.birthday")}
          </dt>
          <dd>{formatDateOnly(signup.contactSet.dateOfBirth)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("roadie.field.positionAppliedFor")}
          </dt>
          <dd>{signup.profile.positionAppliedFor || t("roadie.field.none")}</dd>
        </div>
      </dl>

      <div className="mt-4">
        {duplicatesLoading ? (
          <p className="text-sm text-muted-foreground">
            {t("approvals.signup.duplicates.loading")}
          </p>
        ) : (
          <DuplicateList matches={duplicates ?? []} />
        )}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`main-${key}`}>
            {t("approvals.signup.main.label")}
          </Label>
          <Select value={mainPositionId} onValueChange={setMainPositionId}>
            <SelectTrigger
              id={`main-${key}`}
              data-ocid="approvals.signup.main.select"
              className="touch-target w-full"
            >
              <SelectValue
                placeholder={t("approvals.signup.main.placeholder")}
              />
            </SelectTrigger>
            <SelectContent>
              {positions.map((position) => (
                <SelectItem
                  key={position.id.toString()}
                  value={position.id.toString()}
                >
                  {position.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`second-${key}`}>
            {t("approvals.signup.second.label")}
          </Label>
          <Select value={secondPositionId} onValueChange={setSecondPositionId}>
            <SelectTrigger
              id={`second-${key}`}
              data-ocid="approvals.signup.second.select"
              className="touch-target w-full"
            >
              <SelectValue placeholder={t("approvals.signup.second.none")} />
            </SelectTrigger>
            <SelectContent>
              {positions
                .filter((position) => position.id.toString() !== mainPositionId)
                .map((position) => (
                  <SelectItem
                    key={position.id.toString()}
                    value={position.id.toString()}
                  >
                    {position.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`crew-${key}`}>
            {t("approvals.signup.crew.label")}
          </Label>
          <Select
            value={crewId || NO_CREW}
            onValueChange={(value) => {
              setCrewTouched(true);
              setCrewId(value === NO_CREW ? "" : value);
            }}
          >
            <SelectTrigger
              id={`crew-${key}`}
              data-ocid="approvals.signup.crew.select"
              className="touch-target w-full"
            >
              <SelectValue placeholder={t("approvals.signup.crew.none")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CREW}>
                {t("approvals.signup.crew.none")}
              </SelectItem>
              {crews.map((crew) => (
                <SelectItem key={crew.id.toString()} value={crew.id.toString()}>
                  {crew.name} ·{" "}
                  {crew.roadieCount === 1n
                    ? t("approvals.signup.crew.roadies.one")
                    : t("approvals.signup.crew.roadies", {
                        count: crew.roadieCount.toString(),
                      })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fewestCrewId && (
            <p className="text-xs text-muted-foreground">
              {t("approvals.signup.crew.default")}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`orientation-${key}`}>
            {t("approvals.signup.orientation.label")}
          </Label>
          <Select
            value={orientationId || suggestedOrientation}
            onValueChange={setOrientationId}
          >
            <SelectTrigger
              id={`orientation-${key}`}
              data-ocid="approvals.signup.orientation.select"
              className="touch-target w-full"
            >
              <SelectValue
                placeholder={t("approvals.signup.orientation.placeholder")}
              />
            </SelectTrigger>
            <SelectContent>
              {sessions.map((session) => (
                <SelectItem
                  key={session.id.toString()}
                  value={session.id.toString()}
                >
                  {session.name} · {formatTimestamp(session.start, timeZone)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {t("approvals.signup.orientation.hint")}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`start-${key}`}>
            {t("approvals.signup.start.label")}
          </Label>
          <Input
            id={`start-${key}`}
            type="date"
            value={startDate}
            onChange={(event) => {
              setStartDateTouched(true);
              setStartDate(event.target.value);
            }}
            data-ocid="approvals.signup.start.input"
            className="touch-target"
          />
        </div>
      </div>

      <div className="mt-4">
        <ManagerSignaturePad value={signature} onChange={setSignature} />
      </div>

      {ageBlocked && (
        <p
          role="alert"
          data-ocid="approvals.signup.minor.error"
          className="mt-3 text-sm text-destructive"
        >
          {t("approvals.signup.minor.blocked")}
        </p>
      )}

      {error && (
        <p
          role="alert"
          data-ocid="approvals.signup.error_state"
          className="mt-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className="touch-target"
          data-ocid="approvals.signup.reject_button"
          disabled={reject.isPending || approve.isPending}
          onClick={() => setRejectOpen(true)}
        >
          <X className="mr-2 h-4 w-4" aria-hidden="true" />
          {t("approvals.action.reject")}
        </Button>
        <Button
          type="button"
          className="touch-target"
          data-ocid="approvals.signup.approve_button"
          disabled={approve.isPending || ageBlocked}
          onClick={submit}
        >
          <UserCheck className="mr-2 h-4 w-4" aria-hidden="true" />
          {t("approvals.signup.action.approve")}
        </Button>
      </div>

      <RejectConfirmDialog
        open={rejectOpen}
        pending={reject.isPending}
        onOpenChange={setRejectOpen}
        onConfirm={confirmReject}
      />
    </li>
  );
}

/** The pending kiosk submissions queue with its loading, error, and empty states. */
function PendingSignupList({
  signups,
  positions,
  crews,
  sessions,
  timeZone,
  isLoading,
  isError,
  onRetry,
}: {
  signups: SignupSubmission[] | undefined;
  positions: Position[];
  crews: CrewSummary[];
  sessions: ScheduleEvent[];
  timeZone: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const { t } = useI18n();

  if (isLoading) {
    return <LoadingState label={t("approvals.signup.loading")} />;
  }

  if (isError) {
    return (
      <ErrorState message={t("approvals.signup.error")} onRetry={onRetry} />
    );
  }

  if ((signups?.length ?? 0) === 0) {
    return <EmptyState title={t("approvals.signup.empty")} />;
  }

  return (
    <ul className="space-y-4" data-ocid="approvals.signup.list">
      {signups?.map((signup) => (
        <PendingSignupCard
          key={signup.id.toString()}
          signup={signup}
          positions={positions}
          crews={crews}
          sessions={sessions}
          timeZone={timeZone}
        />
      ))}
    </ul>
  );
}

/**
 * Approve new hires. Admins review each pending sign-in, assign a role and
 * optional trainer stations, access end date, and linked roadie card. Store
 * Managers review pending kiosk submissions, run the duplicate check, assign
 * position, crew, orientation and start date, then sign to create the card.
 * The pending sign-in (access) section is visible only to admins.
 */
export default function ApprovalsPage() {
  const { t } = useI18n();
  const access = useAccessState();
  const role = access.kind === "granted" ? access.grant.role : undefined;
  const isAdmin = canAdmin(role);

  const { data: storeInfo } = useStoreInfo();
  const timeZone = storeInfo?.timeZone || DEFAULT_TIME_ZONE;

  const {
    data: pending,
    isLoading,
    isError,
    refetch,
  } = usePendingUsers(isAdmin);
  const {
    data: signups,
    isLoading: signupsLoading,
    isError: signupsError,
    refetch: refetchSignups,
  } = usePendingSignups();
  const { data: positions } = usePositions();
  const { data: crews } = useCrewSummaries();
  const { data: schedule } = useSchedule();

  const sessions = useMemo(
    () => upcomingOrientations(schedule ?? []),
    [schedule],
  );

  return (
    <div className="space-y-8" data-ocid="approvals.page">
      <PageHeader
        title={t("approvals.title")}
        subtitle={t("approvals.subtitle")}
      />

      <section className="space-y-4" data-ocid="approvals.signups.section">
        <h2 className="font-display text-lg font-semibold uppercase tracking-wide">
          {t("approvals.signup.section")}
        </h2>
        <PendingSignupList
          signups={signups}
          positions={positions ?? []}
          crews={crews ?? []}
          sessions={sessions}
          timeZone={timeZone}
          isLoading={signupsLoading}
          isError={signupsError}
          onRetry={() => void refetchSignups()}
        />
      </section>

      {isAdmin && (
        <section className="space-y-4" data-ocid="approvals.users.section">
          <h2 className="font-display text-lg font-semibold uppercase tracking-wide">
            {t("approvals.users.section")}
          </h2>
          <PendingApprovalList
            pending={pending}
            isLoading={isLoading}
            isError={isError}
            onRetry={() => void refetch()}
          />
        </section>
      )}
    </div>
  );
}
