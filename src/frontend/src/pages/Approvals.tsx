import {
  type ApprovalDecision,
  type Crew,
  type DateOnly,
  type DuplicateMatch,
  EventKind,
  type Position,
  type ScheduleEvent,
  type SignupSubmission,
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
  useCrews,
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
} from "@/lib/format";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Check, UserCheck, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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
  approverPrincipal,
}: {
  signup: SignupSubmission;
  positions: Position[];
  crews: Crew[];
  sessions: ScheduleEvent[];
  timeZone: string;
  approverPrincipal: string | null;
}) {
  const { t } = useI18n();
  const { data: duplicates, isLoading: duplicatesLoading } =
    useSignupDuplicates(signup.id);
  const approve = useApproveSignup();
  const reject = useRejectSignup();

  // The crew led by the approving user, if any, is the default selection.
  const ledCrewId = useMemo(() => {
    if (!approverPrincipal) return "";
    const led = crews.find(
      (crew) => crew.leaderPrincipal?.toString() === approverPrincipal,
    );
    return led ? led.id.toString() : "";
  }, [crews, approverPrincipal]);

  const [mainPositionId, setMainPositionId] = useState("");
  const [secondPositionId, setSecondPositionId] = useState("");
  const [crewId, setCrewId] = useState("");
  const [crewTouched, setCrewTouched] = useState(false);
  const [orientationId, setOrientationId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [signature, setSignature] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);

  // Pre-select the crew led by the approving user once the crews load, unless
  // the manager has already chosen a crew themselves.
  useEffect(() => {
    if (!crewTouched && ledCrewId) setCrewId(ledCrewId);
  }, [crewTouched, ledCrewId]);

  const mainPosition = positions.find(
    (position) => position.id.toString() === mainPositionId,
  );
  const secondPosition = positions.find(
    (position) => position.id.toString() === secondPositionId,
  );
  const suggestedOrientation = defaultOrientationId(sessions);

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
      <div className="flex flex-wrap items-start justify-between gap-2">
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
            value={crewId}
            onValueChange={(value) => {
              setCrewTouched(true);
              setCrewId(value);
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
              {crews.map((crew) => (
                <SelectItem key={crew.id.toString()} value={crew.id.toString()}>
                  {crew.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {ledCrewId && (
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
            onChange={(event) => setStartDate(event.target.value)}
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
  approverPrincipal,
  isLoading,
  isError,
  onRetry,
}: {
  signups: SignupSubmission[] | undefined;
  positions: Position[];
  crews: Crew[];
  sessions: ScheduleEvent[];
  timeZone: string;
  approverPrincipal: string | null;
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
          approverPrincipal={approverPrincipal}
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
  const approverPrincipal =
    access.kind === "granted" ? access.grant.principal.toString() : null;

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
  const { data: crews } = useCrews();
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
          approverPrincipal={approverPrincipal}
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
