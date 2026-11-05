import type { AbsentAlertView } from "@/backend";
import { Role } from "@/backend";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { ArchiveAlertDialog } from "@/components/alerts/ArchiveAlertDialog";
import { ExcuseAlertDialog } from "@/components/alerts/ExcuseAlertDialog";
import { MoveAlertDialog } from "@/components/alerts/MoveAlertDialog";
import { RoadiePhoto } from "@/components/roadie/RoadiePhoto";
import { Button } from "@/components/ui/button";
import { canSeeAbsentAlerts } from "@/hooks/useAccess";
import { useI18n } from "@/hooks/useI18n";
import { useAbsentAlerts } from "@/hooks/useQueries";
import { formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Archive,
  CalendarClock,
  MessageSquare,
  Phone,
  UserCheck,
} from "lucide-react";
import { useState } from "react";

/** Roles that may call or text an absent roadie's contact phone. */
const CONTACT_ROLES: Role[] = [Role.admin, Role.storeManager];

/** Whether the given role may see the Call and Text contact actions. */
function canContact(role: Role | undefined): boolean {
  return !!role && CONTACT_ROLES.includes(role);
}

/** One absent roadie: photo, name, shift, contact links and alert actions. */
function AbsentAlertCard({
  alert,
  index,
  role,
}: {
  alert: AbsentAlertView;
  index: number;
  role: Role | undefined;
}) {
  const { t } = useI18n();
  const [excuseOpen, setExcuseOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);

  const showContact = canContact(role) && !!alert.phone;
  const phone = alert.phone ?? "";

  return (
    <li
      data-ocid={`alerts.item.${index}`}
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-subtle sm:flex-row sm:items-start"
    >
      <RoadiePhoto
        id={alert.roadieId}
        name={alert.name}
        className="h-16 w-16 shrink-0"
        iconClassName="h-7 w-7"
        ocid={`alerts.item.${index}.photo`}
        fallback={
          <span
            className="flex h-full w-full items-center justify-center font-display text-xl font-bold uppercase tracking-wide text-[#14284B]"
            aria-hidden="true"
          >
            {alert.name.slice(0, 2).toUpperCase()}
          </span>
        }
      />

      <div className="min-w-0 flex-1 space-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              data-ocid={`alerts.item.${index}.name`}
              className="truncate font-display text-base font-semibold uppercase tracking-wide text-foreground"
            >
              {alert.name}
            </h3>
            {alert.archived && (
              <span
                data-ocid={`alerts.item.${index}.archived_badge`}
                className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                {t("today.alerts.archived")}
              </span>
            )}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span
              data-ocid={`alerts.item.${index}.shift`}
              className="inline-flex items-center gap-1.5"
            >
              <CalendarClock className="h-4 w-4" aria-hidden="true" />
              {alert.shiftLabel}
            </span>
            <span aria-hidden="true">·</span>
            <span data-ocid={`alerts.item.${index}.created`}>
              {t("today.alerts.created", {
                time: formatTimestamp(alert.createdAt),
              })}
            </span>
          </p>
        </div>

        {alert.excused && (
          <p
            data-ocid={`alerts.item.${index}.excused`}
            className="rounded-md border border-accent/40 bg-accent/5 px-3 py-2 text-sm text-foreground"
          >
            {t("today.alerts.excused", { reason: alert.excused })}
          </p>
        )}

        {showContact && (
          <div
            data-ocid={`alerts.item.${index}.contact`}
            className="flex flex-wrap items-center gap-2"
          >
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("today.alerts.contact")}
            </span>
            <Button
              asChild
              variant="outline"
              className="touch-target"
              data-ocid={`alerts.item.${index}.call_button`}
            >
              <a href={`tel:${phone}`}>
                <Phone className="mr-2 h-4 w-4" aria-hidden="true" />
                {t("today.alerts.call")}
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              className="touch-target"
              data-ocid={`alerts.item.${index}.text_button`}
            >
              <a href={`sms:${phone}`}>
                <MessageSquare className="mr-2 h-4 w-4" aria-hidden="true" />
                {t("today.alerts.text")}
              </a>
            </Button>
          </div>
        )}

        <div
          data-ocid={`alerts.item.${index}.actions`}
          className="flex flex-wrap items-center gap-2"
        >
          <Button
            type="button"
            variant="outline"
            className="touch-target"
            data-ocid={`alerts.item.${index}.move_button`}
            onClick={() => setMoveOpen(true)}
          >
            <CalendarClock className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("today.alerts.move")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="touch-target"
            data-ocid={`alerts.item.${index}.excuse_button`}
            onClick={() => setExcuseOpen(true)}
          >
            <UserCheck className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("today.alerts.excuse")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="touch-target"
            data-ocid={`alerts.item.${index}.archive_button`}
            onClick={() => setArchiveOpen(true)}
          >
            <Archive className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("today.alerts.archive")}
          </Button>
        </div>
      </div>

      <ExcuseAlertDialog
        alertId={alert.id}
        name={alert.name}
        open={excuseOpen}
        onOpenChange={setExcuseOpen}
      />
      <ArchiveAlertDialog
        alertId={alert.id}
        name={alert.name}
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
      />
      <MoveAlertDialog
        alertId={alert.id}
        name={alert.name}
        open={moveOpen}
        onOpenChange={setMoveOpen}
      />
    </li>
  );
}

/**
 * The absent alerts list for Admin, Store Manager and Training Manager: each
 * absent roadie with their photo, name and shift, plus the alert actions. Call
 * and Text render only for Admin and Store Manager, using the roadie's contact
 * phone as tel: and sms: links. The caller passes `role` so the contact actions
 * are gated; the backend enforces the same boundary.
 */
export function AbsentAlertsList({
  role,
  className,
}: {
  role: Role | undefined;
  className?: string;
}) {
  const { t } = useI18n();
  // Only roles the backend permits may read the alerts; a role the backend
  // rejects must not fire the read at all.
  const mayRead = canSeeAbsentAlerts(role);
  const { data, isLoading, isError, refetch } = useAbsentAlerts(mayRead);

  const alerts = data ?? [];

  return (
    <section
      data-ocid="alerts.section"
      aria-label={t("today.alerts.title")}
      className={cn("space-y-4", className)}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-xl font-bold uppercase tracking-wide text-foreground">
          {t("today.alerts.title")}
        </h2>
        {alerts.length > 0 && (
          <span
            data-ocid="alerts.count"
            className="inline-flex items-center rounded-full border border-primary/40 bg-primary/5 px-3 py-1 font-display text-xs font-semibold uppercase tracking-widest text-primary"
          >
            {alerts.length}
          </span>
        )}
      </div>

      {isLoading && (
        <LoadingState
          label={t("today.alerts.loading")}
          ocid="alerts.loading_state"
        />
      )}

      {isError && (
        <ErrorState
          message={t("today.alerts.error")}
          onRetry={() => void refetch()}
          ocid="alerts.error_state"
        />
      )}

      {!isLoading && !isError && alerts.length === 0 && (
        <EmptyState title={t("today.alerts.empty")} ocid="alerts.empty_state" />
      )}

      {!isLoading && !isError && alerts.length > 0 && (
        <ul data-ocid="alerts.list" className="space-y-3">
          {alerts.map((alert, index) => (
            <AbsentAlertCard
              key={alert.id.toString()}
              alert={alert}
              index={index}
              role={role}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
