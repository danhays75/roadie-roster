import { Role } from "@/backend";
import { AdminSection, FormField } from "@/components/admin/FormField";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAccessState } from "@/hooks/useAccess";
import { useDemo, useDemoData } from "@/hooks/useDemo";
import { useI18n } from "@/hooks/useI18n";
import { useStoreInfo } from "@/hooks/useQueries";
import { formatTimestamp } from "@/lib/format";
import { Database, Loader2, Power, Trash2 } from "lucide-react";
import { useState } from "react";

/** The literal an Admin must type to turn demo mode on. */
const DEMO_CONFIRMATION = "DEMO";

/**
 * Self-contained copy for the demo-mode panel. The shared dictionary is
 * foundation-owned, so the panel keeps its own strings here and reads the
 * active locale from `useI18n()`.
 */
interface DemoPanelCopy {
  title: string;
  description: string;
  loading: string;
  error: string;
  switchLabel: string;
  switchHint: string;
  confirmLabel: string;
  confirmPlaceholder: string;
  confirmHint: string;
  confirmError: string;
  turnOn: string;
  turnOff: string;
  on: string;
  off: string;
  autoOff: string;
  dataTitle: string;
  dataDescription: string;
  dataCounts: string;
  dataEmpty: string;
  loadData: string;
  clearData: string;
  clearTitle: string;
  clearBody: string;
  clearConfirm: string;
  cancel: string;
  dataError: string;
}

const en: DemoPanelCopy = {
  title: "Demo mode",
  description:
    "Turn on a safe sandbox with fake records. Real data is never touched.",
  loading: "Checking demo mode…",
  error: "We couldn't load the demo mode state.",
  switchLabel: "Demo mode",
  switchHint:
    "Off by default. Only an Admin can turn it on, and it turns itself off after 8 hours.",
  confirmLabel: "Type DEMO to confirm",
  confirmPlaceholder: "DEMO",
  confirmHint: "Type DEMO exactly to turn demo mode on.",
  confirmError: "Type DEMO to turn demo mode on.",
  turnOn: "Turn on demo mode",
  turnOff: "Turn off demo mode",
  on: "Demo mode is on.",
  off: "Demo mode is off.",
  autoOff: "Turns off automatically at {time}.",
  dataTitle: "Demo data",
  dataDescription:
    "Load a full set of fake roadies, crews, leaders and sign-ups, or clear them.",
  dataCounts:
    "{roadies} roadies · {leaders} leaders · {signups} sign-ups · {crews} crews",
  dataEmpty: "No demo data loaded yet.",
  loadData: "Load demo data",
  clearData: "Clear demo data",
  clearTitle: "Clear demo data",
  clearBody:
    "Remove every demo record? Real records are never touched. This cannot be undone.",
  clearConfirm: "Clear demo data",
  cancel: "Cancel",
  dataError: "We couldn't update the demo data.",
};

const es: DemoPanelCopy = {
  title: "Modo demo",
  description:
    "Activa un entorno seguro con registros falsos. Los datos reales nunca se tocan.",
  loading: "Comprobando el modo demo…",
  error: "No pudimos cargar el estado del modo demo.",
  switchLabel: "Modo demo",
  switchHint:
    "Desactivado por defecto. Solo un administrador puede activarlo y se desactiva solo tras 8 horas.",
  confirmLabel: "Escribe DEMO para confirmar",
  confirmPlaceholder: "DEMO",
  confirmHint: "Escribe DEMO exactamente para activar el modo demo.",
  confirmError: "Escribe DEMO para activar el modo demo.",
  turnOn: "Activar modo demo",
  turnOff: "Desactivar modo demo",
  on: "El modo demo está activado.",
  off: "El modo demo está desactivado.",
  autoOff: "Se desactiva automáticamente a las {time}.",
  dataTitle: "Datos demo",
  dataDescription:
    "Carga un conjunto completo de roadies, equipos, líderes y registros falsos, o bórralos.",
  dataCounts:
    "{roadies} roadies · {leaders} líderes · {signups} registros · {crews} equipos",
  dataEmpty: "Aún no hay datos demo cargados.",
  loadData: "Cargar datos demo",
  clearData: "Borrar datos demo",
  clearTitle: "Borrar datos demo",
  clearBody:
    "¿Eliminar todos los registros demo? Los registros reales nunca se tocan. No se puede deshacer.",
  clearConfirm: "Borrar datos demo",
  cancel: "Cancelar",
  dataError: "No pudimos actualizar los datos demo.",
};

const demoPanelCopy: Record<string, DemoPanelCopy> = { en, es };

/** Interpolate `{name}` placeholders in a demo panel copy string. */
function fill(template: string, vars: Record<string, string | number>): string {
  let value = template;
  for (const [name, replacement] of Object.entries(vars)) {
    value = value.replaceAll(`{${name}}`, String(replacement));
  }
  return value;
}

/**
 * The demo data controls (Admin, demo mode only): load and clear the demo data
 * set, with the current record counts. Rendered only while demo mode is on.
 */
function DemoDataControls({ copy }: { copy: DemoPanelCopy }) {
  const data = useDemoData(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const summary = data.summary;

  const counts = summary
    ? fill(copy.dataCounts, {
        roadies: summary.roadies.toString(),
        leaders: summary.leaders.toString(),
        signups: summary.signups.toString(),
        crews: summary.crews.toString(),
      })
    : copy.dataEmpty;

  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/40 p-4">
      <div className="min-w-0">
        <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          {copy.dataTitle}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {copy.dataDescription}
        </p>
      </div>

      <p
        className="text-sm font-medium text-foreground"
        data-ocid="admin.demo.data_counts"
      >
        {counts}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          className="touch-target"
          data-ocid="admin.demo.load_data_button"
          disabled={data.isPending}
          onClick={() => data.load()}
        >
          {data.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Database className="mr-2 h-4 w-4" aria-hidden="true" />
          )}
          {copy.loadData}
        </Button>
        <Button
          type="button"
          variant="destructive"
          className="touch-target"
          data-ocid="admin.demo.clear_data_button"
          disabled={data.isPending}
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
          {copy.clearData}
        </Button>
      </div>

      {data.error && (
        <p
          className="text-sm font-medium text-destructive"
          role="alert"
          data-ocid="admin.demo.data_error_state"
        >
          {copy.dataError}
        </p>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{copy.clearTitle}</DialogTitle>
            <DialogDescription>{copy.clearBody}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="touch-target"
              data-ocid="admin.demo.clear_cancel_button"
              onClick={() => setConfirmOpen(false)}
            >
              {copy.cancel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="touch-target"
              data-ocid="admin.demo.clear_confirm_button"
              disabled={data.isPending}
              onClick={() => {
                data.clear();
                setConfirmOpen(false);
              }}
            >
              {data.isPending && (
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              )}
              {copy.clearConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * The Admin Store settings demo-mode switch. Off by default and off on a fresh
 * install; only an Admin can turn it on, and turning it on requires typing
 * DEMO. While on it shows when it will auto-off and the demo data controls.
 */
export function DemoModePanel() {
  const { locale } = useI18n();
  const copy = demoPanelCopy[locale] ?? en;
  const demo = useDemo();
  const access = useAccessState();
  const store = useStoreInfo();
  const [confirmation, setConfirmation] = useState("");
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const isAdmin = access.kind === "granted" && access.grant.role === Role.admin;

  // Only an Admin may see or use the demo switch. The backend enforces the same
  // rule, so this is a display gate rather than the authorization boundary.
  if (!isAdmin) return null;

  if (demo.state === null) {
    return (
      <AdminSection title={copy.title} ocid="admin.demo.section">
        <p className="text-sm text-muted-foreground">{copy.loading}</p>
      </AdminSection>
    );
  }

  const autoOff =
    demo.enabled && demo.autoOffAt !== null
      ? formatTimestamp(demo.autoOffAt, store.data?.timeZone)
      : null;

  const onToggle = (checked: boolean) => {
    if (checked) {
      if (confirmation.trim() !== DEMO_CONFIRMATION) {
        setConfirmError(copy.confirmError);
        return;
      }
      setConfirmError(null);
      demo.setEnabled(true, DEMO_CONFIRMATION);
      return;
    }
    setConfirmError(null);
    demo.setEnabled(false, "");
  };

  return (
    <AdminSection
      title={copy.title}
      description={copy.description}
      ocid="admin.demo.section"
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Label
              htmlFor="admin-demo-switch"
              className="font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground"
            >
              {copy.switchLabel}
            </Label>
            <p className="mt-1 text-xs text-muted-foreground">
              {copy.switchHint}
            </p>
          </div>
          <Switch
            id="admin-demo-switch"
            data-ocid="admin.demo.switch"
            checked={demo.enabled}
            disabled={demo.isPending}
            onCheckedChange={onToggle}
          />
        </div>

        {!demo.enabled && (
          <FormField
            label={copy.confirmLabel}
            htmlFor="admin-demo-confirm"
            hint={copy.confirmHint}
            error={confirmError ?? undefined}
          >
            <Input
              id="admin-demo-confirm"
              data-ocid="admin.demo.confirm.input"
              className="touch-target sm:max-w-xs"
              value={confirmation}
              placeholder={copy.confirmPlaceholder}
              autoComplete="off"
              onChange={(event) => {
                setConfirmation(event.target.value);
                if (confirmError) setConfirmError(null);
              }}
            />
          </FormField>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant={demo.enabled ? "outline" : "default"}
            className="touch-target"
            data-ocid={
              demo.enabled
                ? "admin.demo.turn_off_button"
                : "admin.demo.turn_on_button"
            }
            disabled={demo.isPending}
            onClick={() => onToggle(!demo.enabled)}
          >
            {demo.isPending ? (
              <Loader2
                className="mr-2 h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Power className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            {demo.enabled ? copy.turnOff : copy.turnOn}
          </Button>
          <p
            className={
              demo.enabled
                ? "text-sm font-medium text-accent"
                : "text-sm text-muted-foreground"
            }
            data-ocid={
              demo.enabled ? "admin.demo.on_state" : "admin.demo.off_state"
            }
          >
            {demo.enabled ? copy.on : copy.off}
          </p>
        </div>

        {autoOff && (
          <p
            className="text-sm text-muted-foreground"
            data-ocid="admin.demo.auto_off"
          >
            {fill(copy.autoOff, { time: autoOff })}
          </p>
        )}

        {demo.error && (
          <p
            className="text-sm font-medium text-destructive"
            role="alert"
            data-ocid="admin.demo.error_state"
          >
            {demo.error}
          </p>
        )}

        {demo.enabled && <DemoDataControls copy={copy} />}
      </div>
    </AdminSection>
  );
}
