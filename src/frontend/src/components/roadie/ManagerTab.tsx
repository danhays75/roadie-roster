import type { ChecklistItem, ContactSet, Roadie, RoadieId } from "@/backend";
import { EmptyState, LoadingState } from "@/components/States";
import { StatusBadge } from "@/components/StatusBadge";
import { OrientationSessionControl } from "@/components/roadie/OrientationSessionControl";
import { SHIFTS, WEEKDAYS } from "@/components/roadie/constants";
import {
  useChecklists,
  useContactSet,
  useResignAvailability,
  useRoadieChangeLog,
  useUpdateContactSet,
} from "@/components/roadie/useRoadieActions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { canEditRoadie, useAccessState } from "@/hooks/useAccess";
import { useI18n } from "@/hooks/useI18n";
import {
  useOrientationCheckoff,
  usePositions,
  useSetPaperworkItems,
} from "@/hooks/useQueries";
import { formatDateOnly, formatTimestamp, refToDataUrl } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Check, Eraser, PenLine } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-display text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-sm text-foreground">{value}</dd>
    </div>
  );
}

function Section({
  title,
  children,
  ocid,
}: {
  title: string;
  children: React.ReactNode;
  ocid: string;
}) {
  return (
    <section
      data-ocid={ocid}
      className="rounded-lg border border-border bg-card p-5 shadow-subtle"
    >
      <h2 className="mb-4 font-display text-lg font-bold uppercase tracking-wide">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** The editable contact fields the editor owns. */
type ContactField =
  | "phone"
  | "email"
  | "emergencyContactName"
  | "emergencyContactPhone";

/**
 * Contact-set editor: phone, email and emergency contact. On save it merges
 * only the fields the manager actually edited into the latest contact set, so
 * a signature drawn elsewhere (for example a re-sign) is never overwritten.
 */
function ContactEditor({
  id,
  contactSet,
}: {
  id: RoadieId;
  contactSet: ContactSet;
}) {
  const { t } = useI18n();
  const update = useUpdateContactSet();
  const [draft, setDraft] = useState<Record<ContactField, string>>({
    phone: contactSet.phone,
    email: contactSet.email,
    emergencyContactName: contactSet.emergencyContactName,
    emergencyContactPhone: contactSet.emergencyContactPhone,
  });
  const [edited, setEdited] = useState<Set<ContactField>>(new Set());

  const set = (key: ContactField, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setEdited((current) => {
      if (current.has(key)) return current;
      const next = new Set(current);
      next.add(key);
      return next;
    });
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        // Merge only the edited fields into the latest contact set so a
        // re-sign (managerSignature) or any other field is preserved.
        const merged: ContactSet = { ...contactSet };
        for (const key of edited) {
          merged[key] = draft[key];
        }
        update.mutate(
          { id, contactSet: merged },
          {
            onSuccess: () => {
              setEdited(new Set());
            },
          },
        );
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contact-phone">{t("roadie.field.phone")}</Label>
          <Input
            id="contact-phone"
            value={draft.phone}
            onChange={(event) => set("phone", event.target.value)}
            data-ocid="roadie.contact.phone_input"
            className="touch-target"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-email">{t("roadie.field.email")}</Label>
          <Input
            id="contact-email"
            type="email"
            value={draft.email}
            onChange={(event) => set("email", event.target.value)}
            data-ocid="roadie.contact.email_input"
            className="touch-target"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-emergency">
            {t("roadie.field.emergencyContact")}
          </Label>
          <Input
            id="contact-emergency"
            value={draft.emergencyContactName}
            onChange={(event) =>
              set("emergencyContactName", event.target.value)
            }
            data-ocid="roadie.contact.emergency_input"
            className="touch-target"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-emergency-phone">
            {t("roadie.field.emergencyPhone")}
          </Label>
          <Input
            id="contact-emergency-phone"
            value={draft.emergencyContactPhone}
            onChange={(event) =>
              set("emergencyContactPhone", event.target.value)
            }
            data-ocid="roadie.contact.emergency_phone_input"
            className="touch-target"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          className="touch-target"
          disabled={update.isPending}
          data-ocid="roadie.contact.save_button"
        >
          {t("common.save")}
        </Button>
        {update.isSuccess && (
          <output
            data-ocid="roadie.contact.success_state"
            className="text-sm text-accent"
          >
            {t("roadie.edit.saved")}
          </output>
        )}
        {update.isError && (
          <span
            role="alert"
            data-ocid="roadie.contact.error_state"
            className="text-sm text-destructive"
          >
            {t("roadie.edit.error")}
          </span>
        )}
      </div>
    </form>
  );
}

/**
 * A pointer-drawn signature canvas. Emits the drawn PNG bytes once the manager
 * lifts the pointer, so the signature is stored as real bytes rather than a
 * placeholder. Mirrors the kiosk signature canvas so drawing feels identical.
 */
function SignaturePad({
  onSigned,
  onClear,
  hasSignature,
}: {
  onSigned: (bytes: Uint8Array) => void;
  onClear: () => void;
  hasSignature: boolean;
}) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [dirty, setDirty] = useState(false);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#14284B";
  }, []);

  // Set the canvas up once on mount. Deliberately no resize listener: a drawn
  // multi-stroke signature must survive a window resize or device rotation.
  useEffect(() => {
    setupCanvas();
  }, [setupCanvas]);

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    const { x, y } = pointFromEvent(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pointFromEvent(event);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!dirty) setDirty(true);
  };

  const finishStroke = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      void blob.arrayBuffer().then((buffer) => {
        onSigned(new Uint8Array(buffer));
      });
    }, "image/png");
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setDirty(false);
    onClear();
  };

  return (
    <div className="space-y-3">
      <canvas
        ref={canvasRef}
        data-ocid="roadie.availability.canvas_target"
        aria-label={t("roadie.field.availabilitySignature")}
        className="h-40 w-full touch-none rounded-md border border-dashed border-input bg-white"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerLeave={finishStroke}
        onPointerCancel={finishStroke}
      />
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <PenLine className="h-4 w-4" aria-hidden="true" />
          {hasSignature ? t("roadie.signed") : t("roadie.unsigned")}
        </p>
        <Button
          type="button"
          variant="outline"
          className="touch-target"
          data-ocid="roadie.availability.clear_button"
          onClick={clear}
          disabled={!dirty && !hasSignature}
        >
          <Eraser className="mr-2 h-4 w-4" aria-hidden="true" />
          {t("common.cancel")}
        </Button>
      </div>
    </div>
  );
}

/**
 * Availability grid with the manager re-sign flow. The manager draws on the
 * canvas and the drawn bytes are stored through the re-sign mutation, which
 * records the manager signature and clears the pending re-sign flag.
 */
function AvailabilityPanel({
  id,
  contactSet,
}: {
  id: RoadieId;
  contactSet: ContactSet;
}) {
  const { t } = useI18n();
  const resign = useResignAvailability();
  const [drawn, setDrawn] = useState<Uint8Array | null>(null);
  const selected = new Set(
    contactSet.availability.map((slot) => `${slot.day}:${slot.shift}`),
  );

  const saveSignature = () => {
    if (!drawn) return;
    resign.mutate(
      { id, signature: drawn },
      {
        onSuccess: () => {
          setDrawn(null);
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {contactSet.availabilityResignPending ? (
          <StatusBadge tone="pending" ocid="roadie.availability.resign_pending">
            {t("roadie.resignPending")}
          </StatusBadge>
        ) : (
          <StatusBadge tone="hired" ocid="roadie.availability.signed">
            {t("roadie.signed")}
          </StatusBadge>
        )}
        <span className="text-sm text-muted-foreground">
          {contactSet.managerSignature ? (
            <span className="inline-flex items-center gap-2">
              {t("roadie.field.availabilitySignature")}:
              <img
                src={refToDataUrl(contactSet.managerSignature) ?? ""}
                alt={t("roadie.field.availabilitySignature")}
                data-ocid="roadie.availability.signature_image"
                className="h-10 w-auto rounded border border-border bg-white"
              />
            </span>
          ) : (
            t("roadie.unsigned")
          )}
        </span>
        {contactSet.managerSignedAt !== undefined && (
          <span className="text-sm text-muted-foreground">
            {t("roadie.field.availabilitySignedAt")}:{" "}
            {formatTimestamp(contactSet.managerSignedAt)}
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] border-collapse text-sm">
          <caption className="sr-only">
            {t("roadie.field.availability")}
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="border-b border-border px-2 py-2 text-left font-display text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
              >
                {t("roadie.field.availability")}
              </th>
              {SHIFTS.map((shift) => (
                <th
                  key={shift.value}
                  scope="col"
                  className="border-b border-border px-2 py-2 text-center font-display text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
                >
                  {t(shift.labelKey)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WEEKDAYS.map((day) => (
              <tr key={day.value}>
                <th
                  scope="row"
                  className="border-b border-border px-2 py-2 text-left font-medium text-foreground"
                >
                  {t(day.labelKey)}
                </th>
                {SHIFTS.map((shift) => {
                  const key = `${day.value}:${shift.value}`;
                  return (
                    <td
                      key={shift.value}
                      className="border-b border-border px-2 py-2 text-center"
                    >
                      <span
                        aria-label={`${t(day.labelKey)} ${t(shift.labelKey)}`}
                        className={cn(
                          "inline-block h-3 w-3 rounded-full",
                          selected.has(key) ? "bg-accent" : "bg-muted",
                        )}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 rounded-md border border-border bg-background p-3">
        <p className="font-display text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t("roadie.field.availabilitySignature")}
        </p>
        <SignaturePad
          hasSignature={drawn !== null}
          onSigned={setDrawn}
          onClear={() => setDrawn(null)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            className="touch-target"
            disabled={!drawn || resign.isPending}
            data-ocid="roadie.availability.resign_button"
            onClick={saveSignature}
          >
            <PenLine className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("roadie.field.availabilitySignature")}
          </Button>
          {resign.isSuccess && (
            <output
              data-ocid="roadie.availability.success_state"
              className="text-sm text-accent"
            >
              {t("roadie.signed")}
            </output>
          )}
          {resign.isError && (
            <span
              role="alert"
              data-ocid="roadie.availability.error_state"
              className="text-sm text-destructive"
            >
              {t("roadie.edit.error")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The paperwork checklist for one roadie. Shows only the items that apply to
 * them (respecting "Only alcohol positions" and "Only under 18"), each with its
 * stored checked state. Admin and Store Manager may toggle an item, which saves
 * through `setPaperworkItems`; every other role sees the list read-only. A
 * "Paperwork x of y" line and a Complete badge summarise progress.
 */
function PaperworkChecklist({ roadie }: { roadie: Roadie }) {
  const { t } = useI18n();
  const id = roadie.id;
  const access = useAccessState();
  const role = access.kind === "granted" ? access.grant.role : undefined;
  const mayEdit = canEditRoadie(role);
  const { data: checklists } = useChecklists();
  const { data: positions } = usePositions();
  const { data: checkoff, isLoading } = useOrientationCheckoff(id, true);
  const save = useSetPaperworkItems();

  const position = (positions ?? []).find(
    (entry) => entry.id === roadie.mainPositionId,
  );
  const needsAlcohol = position?.needsAlcoholCert ?? false;
  const applicable: ChecklistItem[] = (checklists?.paperwork ?? []).filter(
    (item) =>
      (!item.requiresAlcoholCert || needsAlcohol) &&
      (!item.minorOnly || roadie.isMinor),
  );
  const checked = new Set(checkoff?.paperworkItems ?? []);
  const done = applicable.filter((item) => checked.has(item.id.toString()));
  const complete = applicable.length > 0 && done.length === applicable.length;

  const toggle = (item: ChecklistItem, next: boolean) => {
    const ids = new Set(checked);
    const key = item.id.toString();
    if (next) ids.add(key);
    else ids.delete(key);
    save.mutate({ roadieId: id, paperworkItems: [...ids] });
  };

  if (isLoading) return <LoadingState label={t("common.loading")} />;
  if (applicable.length === 0) {
    return <EmptyState title={t("roadie.paperwork.empty")} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span
          data-ocid="roadie.paperwork.progress"
          className="font-display text-sm font-semibold uppercase tracking-wide text-foreground"
        >
          {t("roadie.paperwork.progress", {
            done: done.length,
            total: applicable.length,
          })}
        </span>
        {complete && (
          <StatusBadge tone="hired" ocid="roadie.paperwork.complete">
            <Check className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            {t("roadie.paperwork.complete")}
          </StatusBadge>
        )}
      </div>

      <ul className="space-y-3">
        {applicable.map((item) => {
          const key = item.id.toString();
          const isChecked = checked.has(key);
          return (
            <li key={key} className="flex items-start gap-3">
              <Checkbox
                id={`paperwork-${key}`}
                checked={isChecked}
                disabled={!mayEdit || save.isPending}
                data-ocid="roadie.paperwork.checkbox"
                onCheckedChange={(next) => toggle(item, next === true)}
              />
              <Label
                htmlFor={`paperwork-${key}`}
                className="text-sm font-normal text-foreground"
              >
                {item.text}
                {item.minorOnly && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {t("roadie.minor")}
                  </span>
                )}
              </Label>
            </li>
          );
        })}
      </ul>

      {save.isError && (
        <p
          role="alert"
          data-ocid="roadie.paperwork.error_state"
          className="text-sm text-destructive"
        >
          {t("roadie.paperwork.saveError")}
        </p>
      )}
    </div>
  );
}

/** The manager-only tab: contact set, availability, paperwork, history. */
export function ManagerTab({ roadie }: { roadie: Roadie }) {
  const { t } = useI18n();
  const id = roadie.id;
  const { data: contactSet, isLoading } = useContactSet(id, true);
  const { data: changeLog } = useRoadieChangeLog(id);

  return (
    <div className="space-y-5" data-ocid="roadie.manager.panel">
      <p className="text-sm text-muted-foreground">{t("roadie.managerOnly")}</p>

      <Section
        title={t("roadie.section.contact")}
        ocid="roadie.manager.contact"
      >
        {isLoading ? (
          <LoadingState label={t("common.loading")} />
        ) : contactSet ? (
          <ContactEditor id={id} contactSet={contactSet} />
        ) : (
          <EmptyState title={t("roadie.manager.empty")} />
        )}
      </Section>

      <Section
        title={t("roadie.field.orientation")}
        ocid="roadie.manager.orientation"
      >
        <OrientationSessionControl roadie={roadie} />
      </Section>

      <Section
        title={t("roadie.section.availability")}
        ocid="roadie.manager.availability"
      >
        {contactSet ? (
          <AvailabilityPanel id={id} contactSet={contactSet} />
        ) : (
          <EmptyState title={t("roadie.manager.empty")} />
        )}
      </Section>

      <Section
        title={t("roadie.section.paperwork")}
        ocid="roadie.manager.paperwork"
      >
        <PaperworkChecklist roadie={roadie} />
      </Section>

      <Section
        title={t("roadie.field.corporateId")}
        ocid="roadie.manager.corporate"
      >
        <Field
          label={t("roadie.field.corporateId")}
          value={roadie.corporateEmployeeId ?? t("roadie.field.none")}
        />
      </Section>

      <Section
        title={t("roadie.section.changeHistory")}
        ocid="roadie.manager.change_history"
      >
        {changeLog && changeLog.length > 0 ? (
          <ul className="space-y-3">
            {changeLog.map((entry) => (
              <li
                key={entry.id.toString()}
                data-ocid="roadie.change_history.item"
                className="rounded-md border border-border bg-background p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-display text-sm font-semibold uppercase tracking-wide text-foreground">
                    {entry.action}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatTimestamp(entry.at)}
                  </span>
                </div>
                <p className="mt-1 break-words text-sm text-muted-foreground">
                  {entry.detail}
                </p>
                {entry.touchesContactSet && (
                  <span className="mt-2 inline-block text-xs text-muted-foreground">
                    {t("roadie.changeHistory.touchesContact")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title={t("roadie.changeHistory.empty")} />
        )}
      </Section>

      {roadie.contactSet?.dateOfBirth !== undefined && (
        <p className="text-xs text-muted-foreground">
          {t("roadie.field.birthday")}:{" "}
          {formatDateOnly(roadie.contactSet.dateOfBirth)}
        </p>
      )}
    </div>
  );
}
