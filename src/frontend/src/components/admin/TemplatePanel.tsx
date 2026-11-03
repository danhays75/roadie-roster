import { House, UniformItemType } from "@/backend";
import type { Checklists, StoreTemplateFile, TemplatePreview } from "@/backend";
import { DemoSettingsNote } from "@/components/DemoBanner";
import { AdminSection, FormField } from "@/components/admin/FormField";
import { useAdminCopy } from "@/components/admin/useAdminCopy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { canAdmin, useAccessState } from "@/hooks/useAccess";
import { useDemo } from "@/hooks/useDemo";
import { useI18n } from "@/hooks/useI18n";
import {
  useDownloadStoreTemplate,
  useLoadStoreTemplate,
  useSaveStoreTemplate,
} from "@/hooks/useQueries";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Loader2,
  Save,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";

/* ---------------------------------------------------------------------------
   Local copy for the download/load actions. The admin copy dictionary is
   owned by copy.ts; these strings stay local to the panel so the new actions
   do not widen that file's contract.
--------------------------------------------------------------------------- */

interface TemplateActionCopy {
  download: string;
  downloading: string;
  downloadError: string;
  loadTitle: string;
  loadDescription: string;
  loadChoose: string;
  loadParsing: string;
  loadInvalid: string;
  loadPreviewTitle: string;
  loadPreviewPositions: string;
  loadPreviewSchedule: string;
  loadPreviewOrientation: string;
  loadPreviewPaperwork: string;
  loadPreviewLeaderTalk: string;
  loadConfirm: string;
  loadCancel: string;
  loadLoading: string;
  loadSuccess: string;
  loadError: string;
  loadRefused: string;
}

const TEMPLATE_ACTION_COPY: Record<"en" | "es", TemplateActionCopy> = {
  en: {
    download: "Download template",
    downloading: "Preparing…",
    downloadError: "We couldn't build the template file.",
    loadTitle: "Load template",
    loadDescription:
      "Replace this store's positions, schedule and checklists from a template file. Available only before any roadie exists.",
    loadChoose: "Choose a .json template file",
    loadParsing: "Reading template…",
    loadInvalid: "That file isn't a valid store template.",
    loadPreviewTitle: "Review before loading",
    loadPreviewPositions: "Positions",
    loadPreviewSchedule: "Schedule events",
    loadPreviewOrientation: "Orientation items",
    loadPreviewPaperwork: "Paperwork items",
    loadPreviewLeaderTalk: "Leader talk",
    loadConfirm: "Load template",
    loadCancel: "Cancel",
    loadLoading: "Loading…",
    loadSuccess:
      "Template loaded. Positions, schedule and checklists replaced.",
    loadError: "We couldn't load the template.",
    loadRefused: "Cannot load a template once roadies exist.",
  },
  es: {
    download: "Descargar plantilla",
    downloading: "Preparando…",
    downloadError: "No pudimos generar el archivo de plantilla.",
    loadTitle: "Cargar plantilla",
    loadDescription:
      "Reemplaza los puestos, el calendario y las listas de esta tienda desde un archivo de plantilla. Solo disponible antes de que exista algún roadie.",
    loadChoose: "Elige un archivo de plantilla .json",
    loadParsing: "Leyendo plantilla…",
    loadInvalid: "Ese archivo no es una plantilla de tienda válida.",
    loadPreviewTitle: "Revisa antes de cargar",
    loadPreviewPositions: "Puestos",
    loadPreviewSchedule: "Eventos del calendario",
    loadPreviewOrientation: "Elementos de orientación",
    loadPreviewPaperwork: "Elementos de papeleo",
    loadPreviewLeaderTalk: "Charla del líder",
    loadConfirm: "Cargar plantilla",
    loadCancel: "Cancelar",
    loadLoading: "Cargando…",
    loadSuccess:
      "Plantilla cargada. Se reemplazaron puestos, calendario y listas.",
    loadError: "No pudimos cargar la plantilla.",
    loadRefused: "No se puede cargar una plantilla cuando ya existen roadies.",
  },
};

/* ---------------------------------------------------------------------------
   JSON (de)serialization for the template file. The backend returns bigint
   fields; JSON has no bigint, so numbers are written on download and converted
   back to bigint on load.
--------------------------------------------------------------------------- */

function templateToJson(file: StoreTemplateFile): string {
  return JSON.stringify(
    file,
    (_key, value) => (typeof value === "bigint" ? Number(value) : value),
    2,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toBigInt(value: unknown): bigint | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return BigInt(value);
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return BigInt(value);
  }
  return null;
}

function parseChecklistItems(value: unknown): Checklists["paperwork"] | null {
  if (!Array.isArray(value)) return null;
  const items: Checklists["paperwork"] = [];
  for (const raw of value) {
    if (!isRecord(raw)) return null;
    const id = toBigInt(raw.id);
    if (id === null || typeof raw.text !== "string") return null;
    items.push({
      id,
      text: raw.text,
      requiresAlcoholCert: raw.requiresAlcoholCert === true,
      minorOnly: raw.minorOnly === true,
      itemType:
        raw.itemType === "count"
          ? UniformItemType.count
          : UniformItemType.checkbox,
    });
  }
  return items;
}

/**
 * Validate an uploaded JSON value into a `StoreTemplateFile`. Returns null when
 * the shape is not a store template, so the caller can show a clear error
 * instead of sending a malformed file to the backend.
 */
function parseTemplateFile(value: unknown): StoreTemplateFile | null {
  if (!isRecord(value)) return null;
  const version = toBigInt(value.version);
  const leaderTalkSize = toBigInt(value.leaderTalkSize);
  const trainingGroupSize = toBigInt(value.trainingGroupSize);
  if (
    version === null ||
    leaderTalkSize === null ||
    trainingGroupSize === null ||
    typeof value.leaderTalkName !== "string"
  ) {
    return null;
  }

  if (!Array.isArray(value.positions) || !Array.isArray(value.schedule)) {
    return null;
  }

  const positions: StoreTemplateFile["positions"] = [];
  for (const raw of value.positions) {
    if (!isRecord(raw)) return null;
    const openingBuildTo = toBigInt(raw.openingBuildTo);
    const afterOpeningBuildTo = toBigInt(raw.afterOpeningBuildTo);
    const minimumAge = toBigInt(raw.minimumAge);
    if (
      openingBuildTo === null ||
      afterOpeningBuildTo === null ||
      minimumAge === null ||
      typeof raw.name !== "string" ||
      typeof raw.code !== "string" ||
      (raw.house !== "foh" && raw.house !== "boh")
    ) {
      return null;
    }
    positions.push({
      name: raw.name,
      code: raw.code,
      house: raw.house === "boh" ? House.boh : House.foh,
      openingBuildTo,
      afterOpeningBuildTo,
      minimumAge,
      needsAlcoholCert: raw.needsAlcoholCert === true,
      defaultHats: toBigInt(raw.defaultHats) ?? 0n,
      defaultShirts: toBigInt(raw.defaultShirts) ?? 0n,
    });
  }

  const schedule: StoreTemplateFile["schedule"] = [];
  for (const raw of value.schedule) {
    if (!isRecord(raw)) return null;
    const startOffsetDays = toBigInt(raw.startOffsetDays);
    if (
      startOffsetDays === null ||
      typeof raw.name !== "string" ||
      typeof raw.kind !== "string"
    ) {
      return null;
    }
    const endOffsetDays =
      raw.endOffsetDays === null || raw.endOffsetDays === undefined
        ? undefined
        : toBigInt(raw.endOffsetDays);
    if (endOffsetDays === null) return null;
    schedule.push({
      kind: raw.kind as StoreTemplateFile["schedule"][number]["kind"],
      name: raw.name,
      startOffsetDays,
      endOffsetDays,
    });
  }

  if (!isRecord(value.checklists)) return null;
  const orientationUniform = parseChecklistItems(
    value.checklists.orientationUniform,
  );
  const paperwork = parseChecklistItems(value.checklists.paperwork);
  if (orientationUniform === null || paperwork === null) return null;

  return {
    version,
    leaderTalkName: value.leaderTalkName,
    leaderTalkSize,
    trainingGroupSize,
    positions,
    schedule,
    checklists: { orientationUniform, paperwork },
  };
}

/** Trigger a browser download for a text file. */
function downloadTextFile(filename: string, text: string): void {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function TemplatePanel() {
  const c = useAdminCopy();
  const { locale } = useI18n();
  const copy = TEMPLATE_ACTION_COPY[locale === "es" ? "es" : "en"];
  const access = useAccessState();
  const demo = useDemo();
  const isAdmin = access.kind === "granted" && canAdmin(access.grant.role);

  const save = useSaveStoreTemplate();
  const download = useDownloadStoreTemplate();
  const load = useLoadStoreTemplate();

  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<StoreTemplateFile | null>(
    null,
  );
  const [preview, setPreview] = useState<TemplatePreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadSuccess, setLoadSuccess] = useState(false);

  // While demo mode is on the store template controls are hidden: they change
  // real settings, which demo mode must not touch.
  if (demo.enabled) {
    return (
      <AdminSection
        title={c.templateTitle}
        description={c.templateDescription}
        ocid="admin.template.section"
      >
        <DemoSettingsNote />
      </AdminSection>
    );
  }

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaved(false);
    save.mutate(trimmed, {
      onSuccess: () => {
        setSaved(true);
        setName("");
      },
    });
  };

  const onDownload = () => {
    download.mutate(undefined, {
      onSuccess: (file) => {
        downloadTextFile("store-template.json", templateToJson(file));
      },
    });
  };

  const resetLoad = () => {
    setPendingFile(null);
    setPreview(null);
    setLoadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setLoadSuccess(false);
    setLoadError(null);
    setPreview(null);
    setPendingFile(null);
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseTemplateFile(JSON.parse(text));
      if (!parsed) {
        setLoadError(copy.loadInvalid);
        return;
      }
      setPendingFile(parsed);
      setPreview({
        positionCount: BigInt(parsed.positions.length),
        scheduleCount: BigInt(parsed.schedule.length),
        orientationUniformCount: BigInt(
          parsed.checklists.orientationUniform.length,
        ),
        paperworkCount: BigInt(parsed.checklists.paperwork.length),
        leaderTalkName: parsed.leaderTalkName,
      });
    } catch {
      setLoadError(copy.loadInvalid);
    }
  };

  const onConfirmLoad = () => {
    if (!pendingFile) return;
    setLoadError(null);
    load.mutate(pendingFile, {
      onSuccess: (result) => {
        if (result.__kind__ === "ok") {
          setLoadSuccess(true);
          resetLoad();
        } else {
          setLoadError(
            result.err === "Cannot load a template once roadies exist"
              ? copy.loadRefused
              : result.err,
          );
        }
      },
    });
  };

  const includes = [
    c.templateIncludesSchedule,
    c.templateIncludesPositions,
    c.templateIncludesChecklists,
    c.templateIncludesLeaderTalk,
    c.templateIncludesNoPeople,
  ];

  const previewRows = preview
    ? [
        { label: copy.loadPreviewPositions, value: preview.positionCount },
        { label: copy.loadPreviewSchedule, value: preview.scheduleCount },
        {
          label: copy.loadPreviewOrientation,
          value: preview.orientationUniformCount,
        },
        { label: copy.loadPreviewPaperwork, value: preview.paperworkCount },
      ]
    : [];

  return (
    <AdminSection
      title={c.templateTitle}
      description={c.templateDescription}
      ocid="admin.template.section"
    >
      <ul className="mb-5 space-y-2 text-sm text-muted-foreground">
        {includes.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <CheckCircle2
              className="mt-0.5 h-4 w-4 shrink-0 text-accent"
              aria-hidden="true"
            />
            {item}
          </li>
        ))}
      </ul>

      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <FormField
          label={c.templateName}
          htmlFor="template-name"
          className="flex-1"
        >
          <Input
            id="template-name"
            data-ocid="admin.template.name.input"
            className="touch-target"
            placeholder={c.templateNamePlaceholder}
            value={name}
            onChange={(event) => {
              setSaved(false);
              setName(event.target.value);
            }}
          />
        </FormField>
        <Button
          type="submit"
          className="touch-target"
          data-ocid="admin.template.save_button"
          disabled={save.isPending || !name.trim()}
        >
          {save.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="mr-2 h-4 w-4" aria-hidden="true" />
          )}
          {c.templateSave}
        </Button>
      </form>

      {saved && (
        <p
          className="mt-3 text-sm font-medium text-accent"
          data-ocid="admin.template.success_state"
        >
          {c.templateSaved}
        </p>
      )}
      {save.isError && (
        <p
          className="mt-3 text-sm font-medium text-destructive"
          data-ocid="admin.template.error_state"
        >
          {c.templateSaveError}
        </p>
      )}

      <div className="mt-6 border-t border-border pt-5">
        <Button
          type="button"
          variant="outline"
          className="touch-target"
          data-ocid="admin.template.download_button"
          onClick={onDownload}
          disabled={download.isPending}
        >
          {download.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
          )}
          {download.isPending ? copy.downloading : copy.download}
        </Button>
        {download.isError && (
          <p
            className="mt-3 text-sm font-medium text-destructive"
            data-ocid="admin.template.download_error_state"
          >
            {copy.downloadError}
          </p>
        )}
      </div>

      {isAdmin && (
        <div className="mt-6 border-t border-border pt-5">
          <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-foreground">
            {copy.loadTitle}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {copy.loadDescription}
          </p>

          <div className="mt-3">
            <label
              htmlFor="template-file"
              className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-within:ring-2 focus-within:ring-ring"
              data-ocid="admin.template.upload_button"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              {copy.loadChoose}
              <input
                ref={fileInputRef}
                id="template-file"
                type="file"
                accept=".json,application/json"
                className="sr-only"
                data-ocid="admin.template.file_input"
                onChange={onFileChange}
              />
            </label>
          </div>

          {preview && pendingFile && (
            <div
              className="mt-4 rounded-md border border-border bg-muted/40 p-4"
              data-ocid="admin.template.preview_panel"
            >
              <p className="font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {copy.loadPreviewTitle}
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {previewRows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between gap-2"
                  >
                    <dt className="text-muted-foreground">{row.label}</dt>
                    <dd className="font-mono font-semibold text-foreground">
                      {row.value.toString()}
                    </dd>
                  </div>
                ))}
                <div className="col-span-2 flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">
                    {copy.loadPreviewLeaderTalk}
                  </dt>
                  <dd className="min-w-0 truncate font-semibold text-foreground">
                    {preview.leaderTalkName}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="touch-target"
                  data-ocid="admin.template.confirm_button"
                  onClick={onConfirmLoad}
                  disabled={load.isPending}
                >
                  {load.isPending ? (
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  {load.isPending ? copy.loadLoading : copy.loadConfirm}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="touch-target"
                  data-ocid="admin.template.cancel_button"
                  onClick={resetLoad}
                  disabled={load.isPending}
                >
                  {copy.loadCancel}
                </Button>
              </div>
            </div>
          )}

          {loadError && (
            <p
              className="mt-3 flex items-start gap-2 text-sm font-medium text-destructive"
              data-ocid="admin.template.load_error_state"
              role="alert"
            >
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              {loadError}
            </p>
          )}
          {loadSuccess && (
            <p
              className="mt-3 text-sm font-medium text-accent"
              data-ocid="admin.template.load_success_state"
            >
              {copy.loadSuccess}
            </p>
          )}
        </div>
      )}
    </AdminSection>
  );
}
