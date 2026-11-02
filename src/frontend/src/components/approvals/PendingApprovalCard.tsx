import { Role } from "@/backend";
import type { PendingUser, Position, StaffProfile } from "@/backend";
import { ApprovalConfirmDialog } from "@/components/approvals/ApprovalConfirmDialog";
import {
  ASSIGNABLE_ROLES,
  ApprovalRoleSelect,
  needsConfirmation,
} from "@/components/approvals/ApprovalRoleSelect";
import { TrainerStationsPicker } from "@/components/approvals/TrainerStationsPicker";
import {
  DEFAULT_TIME_ZONE,
  zonedWallTimeToDate,
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
import { useAccessState } from "@/hooks/useAccess";
import { useI18n } from "@/hooks/useI18n";
import {
  useApproveUser,
  usePositions,
  useRoadies,
  useStoreInfo,
} from "@/hooks/useQueries";
import {
  dateOnlyToDate,
  dateToTimestamp,
  formatDateOnly,
  formatTimestamp,
  refToDataUrl,
  staffDisplayName,
} from "@/lib/format";
import { Eye, EyeOff, UserCheck } from "lucide-react";
import { useMemo, useState } from "react";

/** Roles whose profile carries trainer stations and travel dates. */
const TRAVEL_ROLES: Role[] = [Role.trainer, Role.visitingManager];

/** Roles allowed to see a staff member's work phone and email. */
const CONTACT_ROLES: Role[] = [Role.admin, Role.storeManager];

/** A `YYYY-MM-DD` value for a date input, read in UTC. */
function dateOnlyToInput(value: bigint | undefined): string {
  if (value === undefined) return "";
  const date = dateOnlyToDate(value);
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

/** The role to pre-select: the requested role when an admin may grant it. */
function initialRole(profile: StaffProfile | undefined): Role | "" {
  if (!profile) return "";
  return ASSIGNABLE_ROLES.includes(profile.requestedRole)
    ? profile.requestedRole
    : "";
}

/** One labelled profile value, hidden when it is blank. */
function ProfileField({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="break-words text-sm text-foreground">{value}</dd>
    </div>
  );
}

/**
 * The submitted staff profile carried on a pending request: name, title, home
 * store, photo, and — for the roles that travel — the stations they train and
 * their arrival and departure dates. Work phone and email are shown only to
 * Admin and Store Manager, matching the roadie contact-info rule.
 */
function StaffProfileSummary({
  profile,
  positions,
  canSeeContact,
}: {
  profile: StaffProfile;
  positions: Position[];
  canSeeContact: boolean;
}) {
  const { t } = useI18n();
  const photoUrl = useMemo(() => refToDataUrl(profile.photo), [profile.photo]);
  const homeStore = [profile.homeStoreNumber, profile.homeStoreCity]
    .filter((part) => part.trim() !== "")
    .join(" · ");
  const showsTravel = TRAVEL_ROLES.includes(profile.requestedRole);
  const trainedPositions = profile.trainerPositionIds
    .map((id) => positions.find((position) => position.id === id)?.name)
    .filter((name): name is string => !!name)
    .join(", ");

  return (
    <div
      data-ocid="approvals.profile.summary"
      className="mt-3 flex flex-col gap-3 rounded-md border border-border bg-muted/30 p-3 sm:flex-row"
    >
      {photoUrl && (
        <img
          src={photoUrl}
          alt={staffDisplayName(profile, t("profile.unnamed"))}
          data-ocid="approvals.profile.photo"
          className="h-16 w-16 shrink-0 rounded-full border-2 border-primary object-cover"
        />
      )}
      <dl className="grid flex-1 gap-2 sm:grid-cols-2">
        <ProfileField label={t("profile.fullName")} value={profile.fullName} />
        <ProfileField
          label={t("profile.preferredName")}
          value={profile.preferredName ?? ""}
        />
        <ProfileField label={t("profile.title.label")} value={profile.title} />
        <ProfileField label={t("profile.homeStoreNumber")} value={homeStore} />
        {canSeeContact && (
          <>
            <ProfileField
              label={t("profile.workPhone")}
              value={profile.workPhone ?? ""}
            />
            <ProfileField
              label={t("profile.workEmail")}
              value={profile.workEmail ?? ""}
            />
          </>
        )}
        {showsTravel && (
          <>
            <ProfileField
              label={t("approvals.stations.label")}
              value={trainedPositions}
            />
            <ProfileField
              label={t("profile.arrivalDate")}
              value={
                profile.arrivalDate !== undefined
                  ? formatDateOnly(profile.arrivalDate)
                  : ""
              }
            />
            <ProfileField
              label={t("profile.departureDate")}
              value={
                profile.departureDate !== undefined
                  ? formatDateOnly(profile.departureDate)
                  : ""
              }
            />
          </>
        )}
      </dl>
    </div>
  );
}

/**
 * One pending sign-in with the full approval form: role, trainer stations,
 * optional access end date, and an optional link to an existing roadie card.
 * The submitted staff profile is shown and its requested role, stations and
 * departure date pre-fill the form, all still editable by the admin.
 */
export function PendingApprovalCard({ user }: { user: PendingUser }) {
  const { t } = useI18n();
  const access = useAccessState();
  const viewerRole = access.kind === "granted" ? access.grant.role : undefined;
  const canSeeContact = !!viewerRole && CONTACT_ROLES.includes(viewerRole);
  const isAdmin = viewerRole === Role.admin;

  const { data: positions } = usePositions();
  const { data: roadies } = useRoadies();
  const { data: storeInfo } = useStoreInfo();
  const approve = useApproveUser();

  const timeZone = storeInfo?.timeZone || DEFAULT_TIME_ZONE;
  const profile = user.staffProfile;

  const [role, setRole] = useState<Role | "">(() => initialRole(profile));
  const [stationIds, setStationIds] = useState<string[]>(() =>
    (profile?.trainerPositionIds ?? []).map((id) => id.toString()),
  );
  const [accessEnd, setAccessEnd] = useState(() =>
    dateOnlyToInput(profile?.departureDate),
  );
  const [linkedRoadieId, setLinkedRoadieId] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showId, setShowId] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const principalText = user.principal.toText();
  const needsStations = role === Role.trainer;
  const displayName = staffDisplayName(profile, t("profile.unnamed"));

  const submit = () => {
    if (role === "") {
      setError(t("approvals.role.required"));
      return;
    }
    setError(null);
    approve.mutate(
      {
        principal: user.principal,
        role,
        staffProfile: user.staffProfile,
        trainerPositionIds: needsStations
          ? stationIds.map((id) => BigInt(id))
          : [],
        accessEndsAt: accessEnd
          ? dateToTimestamp(
              zonedWallTimeToDate(accessEnd, 23, 59, 59, timeZone),
            )
          : undefined,
        linkedRoadieId: linkedRoadieId ? BigInt(linkedRoadieId) : undefined,
      },
      {
        onSuccess: () => {
          setConfirmOpen(false);
          setRole("");
          setStationIds([]);
          setAccessEnd("");
          setLinkedRoadieId("");
        },
        onError: () => setError(t("approvals.error.generic")),
      },
    );
  };

  const handleApproveClick = () => {
    if (role === "") {
      setError(t("approvals.role.required"));
      return;
    }
    setError(null);
    if (needsConfirmation(role)) {
      setConfirmOpen(true);
    } else {
      submit();
    }
  };

  return (
    <li
      data-ocid="approvals.item"
      className="rounded-lg border border-border bg-card p-4 shadow-subtle"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold uppercase tracking-wide">
            {displayName}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("approvals.requestedAt")}: {formatTimestamp(user.requestedAt)}
          </p>
          {isAdmin && showId && (
            <p
              data-ocid="approvals.principal"
              className="mt-1 break-all font-mono text-xs text-muted-foreground"
            >
              {t("profile.principal")}: {principalText}
            </p>
          )}
        </div>
        {isAdmin && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="touch-target"
            data-ocid="approvals.show_id.toggle"
            aria-pressed={showId}
            title={t("profile.showId.hint")}
            onClick={() => setShowId((current) => !current)}
          >
            {showId ? (
              <EyeOff className="mr-2 h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            {t("profile.showId")}
          </Button>
        )}
      </div>

      {profile && (
        <StaffProfileSummary
          profile={profile}
          positions={positions ?? []}
          canSeeContact={canSeeContact}
        />
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <ApprovalRoleSelect
          id={`role-${principalText}`}
          value={role}
          onChange={setRole}
        />

        <div className="space-y-1.5">
          <Label htmlFor={`link-${principalText}`}>
            {t("approvals.link.label")}
          </Label>
          <Select value={linkedRoadieId} onValueChange={setLinkedRoadieId}>
            <SelectTrigger
              id={`link-${principalText}`}
              data-ocid="approvals.link.select"
              className="touch-target w-full"
            >
              <SelectValue placeholder={t("approvals.link.none")} />
            </SelectTrigger>
            <SelectContent>
              {(roadies ?? []).map((roadie) => (
                <SelectItem
                  key={roadie.id.toString()}
                  value={roadie.id.toString()}
                >
                  {roadie.profile.preferredName || roadie.profile.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {t("approvals.link.hint")}
          </p>
        </div>

        {needsStations && (
          <TrainerStationsPicker
            positions={positions ?? []}
            selectedIds={stationIds}
            onChange={setStationIds}
          />
        )}

        <div className="space-y-1.5">
          <Label htmlFor={`end-${principalText}`}>
            {t("approvals.accessEnd.label")}
          </Label>
          <Input
            id={`end-${principalText}`}
            type="date"
            value={accessEnd}
            onChange={(event) => setAccessEnd(event.target.value)}
            data-ocid="approvals.access_end.input"
            className="touch-target"
          />
          <p className="text-xs text-muted-foreground">
            {t("approvals.accessEnd.hint")}
          </p>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          data-ocid="approvals.error_state"
          className="mt-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <div className="mt-4 flex justify-end">
        <Button
          type="button"
          className="touch-target"
          data-ocid="approvals.approve_button"
          disabled={approve.isPending}
          onClick={handleApproveClick}
        >
          <UserCheck className="mr-2 h-4 w-4" aria-hidden="true" />
          {t("approvals.action.approve")}
        </Button>
      </div>

      <ApprovalConfirmDialog
        open={confirmOpen}
        role={role}
        pending={approve.isPending}
        onOpenChange={setConfirmOpen}
        onConfirm={submit}
      />
    </li>
  );
}
