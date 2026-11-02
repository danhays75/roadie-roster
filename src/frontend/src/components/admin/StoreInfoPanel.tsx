import type { PhotoRef, StoreInfo } from "@/backend";
import { AdminSection, FormField } from "@/components/admin/FormField";
import { fill } from "@/components/admin/copy";
import {
  formatTimeOfDay,
  inputToTimeOfDay,
  timeOfDayToInput,
} from "@/components/admin/time";
import { useAdminCopy } from "@/components/admin/useAdminCopy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStoreInfo, useUpdateStoreInfo } from "@/hooks/useQueries";
import {
  dateOnlyToDate,
  dateToDateOnly,
  fileToRef,
  refToDataUrl,
} from "@/lib/format";
import { ImagePlus, Loader2, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** The longest edge, in pixels, an uploaded store logo is scaled to. */
const MAX_LOGO_EDGE = 512;
/** JPEG quality used when re-encoding a non-transparent logo upload. */
const LOGO_JPEG_QUALITY = 0.85;
/** How long to wait for a logo to decode before falling back to the original. */
const LOGO_LOAD_TIMEOUT_MS = 500;

/** Load a `File` into an `HTMLImageElement` for canvas re-encoding. */
function loadLogoImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    const timer = setTimeout(() => {
      URL.revokeObjectURL(url);
      reject(new Error("Timed out reading the logo"));
    }, LOGO_LOAD_TIMEOUT_MS);
    image.onload = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      reject(new Error("Could not read the logo"));
    };
    image.src = url;
  });
}

/**
 * Downscale a store logo to at most `MAX_LOGO_EDGE` on its longest edge. PNG
 * input keeps a PNG output so transparency survives; other raster input is
 * re-encoded as JPEG. SVG (and any file the browser cannot decode) passes
 * through unchanged so vector logos stay crisp.
 */
async function resizeLogoFile(file: File): Promise<File> {
  if (file.type === "image/svg+xml") return file;
  let image: HTMLImageElement;
  try {
    image = await loadLogoImage(file);
  } catch {
    return file;
  }
  const longest = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = longest > MAX_LOGO_EDGE ? MAX_LOGO_EDGE / longest : 1;
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const keepPng = file.type === "image/png";
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(image, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(
      (result) => resolve(result),
      keepPng ? "image/png" : "image/jpeg",
      keepPng ? undefined : LOGO_JPEG_QUALITY,
    );
  });
  if (!blob) return file;
  const name = file.name.replace(/\.[^.]+$/, "") || "logo";
  const ext = keepPng ? "png" : "jpg";
  return new File([blob], `${name}.${ext}`, { type: blob.type });
}

/**
 * Detect the MIME type of stored logo bytes from their magic number so the
 * preview data URL matches the resized output (PNG keeps transparency, other
 * raster input is JPEG). Defaults to PNG for unrecognized bytes.
 */
function logoContentType(ref: PhotoRef): string {
  if (ref.length >= 8 && ref[0] === 0x89 && ref[1] === 0x50) return "image/png";
  if (ref.length >= 3 && ref[0] === 0xff && ref[1] === 0xd8)
    return "image/jpeg";
  if (
    ref.length >= 12 &&
    ref[0] === 0x52 &&
    ref[1] === 0x49 &&
    ref[2] === 0x46 &&
    ref[3] === 0x46 &&
    ref[8] === 0x57 &&
    ref[9] === 0x45 &&
    ref[10] === 0x42 &&
    ref[11] === 0x50
  ) {
    return "image/webp";
  }
  return "image/png";
}

/** Editable draft of the store configuration, with times as `HH:MM` strings. */
interface StoreDraft {
  appName: string;
  storeNumber: string;
  locationName: string;
  address: string;
  storePhone: string;
  openingDate: string;
  timeZone: string;
  amShiftStart: string;
  amShiftEnd: string;
  pmShiftStart: string;
  pmShiftEnd: string;
  leaderTalkName: string;
  trainingGroupSize: string;
  leaderTalkSize: string;
  logo: PhotoRef | undefined;
  secondaryLogo: PhotoRef | undefined;
}

function toDraft(info: StoreInfo): StoreDraft {
  const opening = dateOnlyToDate(info.openingDate);
  return {
    appName: info.appName,
    storeNumber: info.storeNumber,
    locationName: info.locationName,
    address: info.address,
    storePhone: info.storePhone,
    openingDate: opening ? opening.toISOString().slice(0, 10) : "",
    timeZone: info.timeZone,
    amShiftStart: timeOfDayToInput(info.amShiftStart),
    amShiftEnd: timeOfDayToInput(info.amShiftEnd),
    pmShiftStart: timeOfDayToInput(info.pmShiftStart),
    pmShiftEnd: timeOfDayToInput(info.pmShiftEnd),
    leaderTalkName: info.leaderTalkName,
    trainingGroupSize: info.trainingGroupSize.toString(),
    leaderTalkSize: info.leaderTalkSize.toString(),
    logo: info.logo,
    secondaryLogo: info.secondaryLogo,
  };
}

function toStoreInfo(draft: StoreDraft, base: StoreInfo): StoreInfo {
  const opening = new Date(`${draft.openingDate}T00:00:00Z`);
  return {
    ...base,
    appName: draft.appName.trim(),
    storeNumber: draft.storeNumber.trim(),
    locationName: draft.locationName.trim(),
    address: draft.address.trim(),
    storePhone: draft.storePhone.trim(),
    openingDate: Number.isNaN(opening.getTime())
      ? base.openingDate
      : dateToDateOnly(opening),
    timeZone: draft.timeZone.trim(),
    amShiftStart: inputToTimeOfDay(draft.amShiftStart),
    amShiftEnd: inputToTimeOfDay(draft.amShiftEnd),
    pmShiftStart: inputToTimeOfDay(draft.pmShiftStart),
    pmShiftEnd: inputToTimeOfDay(draft.pmShiftEnd),
    leaderTalkName: draft.leaderTalkName.trim(),
    trainingGroupSize: BigInt(
      Math.max(1, Number(draft.trainingGroupSize) || 1),
    ),
    leaderTalkSize: BigInt(Math.max(1, Number(draft.leaderTalkSize) || 1)),
    logo: draft.logo,
    secondaryLogo: draft.secondaryLogo,
  };
}

export function StoreInfoPanel() {
  const c = useAdminCopy();
  const store = useStoreInfo();
  const update = useUpdateStoreInfo();
  const [draft, setDraft] = useState<StoreDraft | null>(null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const secondaryFileRef = useRef<HTMLInputElement>(null);

  // One-time initialization from the loaded record; never overwrite a draft.
  useEffect(() => {
    if (store.data && draft === null) {
      setDraft(toDraft(store.data));
    }
  }, [store.data, draft]);

  if (store.isLoading || !draft) {
    return (
      <AdminSection title={c.storeTitle} ocid="admin.store.section">
        <p className="text-sm text-muted-foreground">{c.storeLoading}</p>
      </AdminSection>
    );
  }

  if (store.isError || !store.data) {
    return (
      <AdminSection title={c.storeTitle} ocid="admin.store.section">
        <p className="text-sm text-destructive">{c.storeError}</p>
      </AdminSection>
    );
  }

  const base = store.data;
  const set = <K extends keyof StoreDraft>(key: K, value: StoreDraft[K]) => {
    setSaved(false);
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  };

  const onLogoChange = (file: File | undefined) => {
    if (!file) return;
    void resizeLogoFile(file)
      .then(fileToRef)
      .then((ref) => set("logo", ref));
  };

  const onSecondaryLogoChange = (file: File | undefined) => {
    if (!file) return;
    void resizeLogoFile(file)
      .then(fileToRef)
      .then((ref) => set("secondaryLogo", ref));
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const payload = toStoreInfo(draft, base);
    update.mutate(payload, { onSuccess: () => setSaved(true) });
  };

  return (
    <AdminSection
      title={c.storeTitle}
      description={c.storeDescription}
      ocid="admin.store.section"
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
            {draft.logo ? (
              <img
                src={
                  refToDataUrl(draft.logo, logoContentType(draft.logo)) ??
                  undefined
                }
                alt={c.storeLogoAlt}
                className="h-full w-full object-contain"
              />
            ) : (
              <ImagePlus
                className="h-7 w-7 text-muted-foreground"
                aria-hidden="true"
              />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="sr-only"
              data-ocid="admin.store.logo.input"
              onChange={(event) => onLogoChange(event.target.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              className="touch-target w-fit"
              data-ocid="admin.store.logo.upload_button"
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus className="mr-2 h-4 w-4" aria-hidden="true" />
              {c.storeLogoUpload}
            </Button>
            {draft.logo && (
              <Button
                type="button"
                variant="ghost"
                className="touch-target w-fit"
                data-ocid="admin.store.logo.remove_button"
                onClick={() => set("logo", undefined)}
              >
                {c.storeLogoRemove}
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
            {draft.secondaryLogo ? (
              <img
                src={
                  refToDataUrl(
                    draft.secondaryLogo,
                    logoContentType(draft.secondaryLogo),
                  ) ?? undefined
                }
                alt={c.storeSecondaryLogoAlt}
                className="h-full w-full object-contain"
              />
            ) : (
              <ImagePlus
                className="h-7 w-7 text-muted-foreground"
                aria-hidden="true"
              />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={secondaryFileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="sr-only"
              data-ocid="admin.store.secondary_logo.input"
              onChange={(event) =>
                onSecondaryLogoChange(event.target.files?.[0])
              }
            />
            <Button
              type="button"
              variant="outline"
              className="touch-target w-fit"
              data-ocid="admin.store.secondary_logo.upload_button"
              onClick={() => secondaryFileRef.current?.click()}
            >
              <ImagePlus className="mr-2 h-4 w-4" aria-hidden="true" />
              {c.storeSecondaryLogoUpload}
            </Button>
            {draft.secondaryLogo && (
              <Button
                type="button"
                variant="ghost"
                className="touch-target w-fit"
                data-ocid="admin.store.secondary_logo.remove_button"
                onClick={() => set("secondaryLogo", undefined)}
              >
                {c.storeSecondaryLogoRemove}
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label={c.storeAppName} htmlFor="store-app-name">
            <Input
              id="store-app-name"
              data-ocid="admin.store.app_name.input"
              className="touch-target"
              value={draft.appName}
              onChange={(event) => set("appName", event.target.value)}
            />
          </FormField>
          <FormField label={c.storeStoreNumber} htmlFor="store-number">
            <Input
              id="store-number"
              data-ocid="admin.store.store_number.input"
              className="touch-target"
              value={draft.storeNumber}
              onChange={(event) => set("storeNumber", event.target.value)}
            />
          </FormField>
          <FormField label={c.storeLocationName} htmlFor="store-location">
            <Input
              id="store-location"
              data-ocid="admin.store.location.input"
              className="touch-target"
              value={draft.locationName}
              onChange={(event) => set("locationName", event.target.value)}
            />
          </FormField>
          <FormField
            label={c.storeAddress}
            htmlFor="store-address"
            className="sm:col-span-2"
          >
            <Input
              id="store-address"
              data-ocid="admin.store.address.input"
              className="touch-target"
              value={draft.address}
              onChange={(event) => set("address", event.target.value)}
            />
          </FormField>
          <FormField label={c.storePhone} htmlFor="store-phone">
            <Input
              id="store-phone"
              type="tel"
              data-ocid="admin.store.phone.input"
              className="touch-target"
              value={draft.storePhone}
              onChange={(event) => set("storePhone", event.target.value)}
            />
          </FormField>
          <FormField label={c.storeOpeningDate} htmlFor="store-opening-date">
            <Input
              id="store-opening-date"
              type="date"
              data-ocid="admin.store.opening_date.input"
              className="touch-target"
              value={draft.openingDate}
              onChange={(event) => set("openingDate", event.target.value)}
            />
          </FormField>
          <FormField label={c.storeTimeZone} htmlFor="store-timezone">
            <Input
              id="store-timezone"
              data-ocid="admin.store.time_zone.input"
              className="touch-target"
              value={draft.timeZone}
              onChange={(event) => set("timeZone", event.target.value)}
            />
          </FormField>
        </div>

        <fieldset className="space-y-4">
          <legend className="font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            {c.storeShifts}
          </legend>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <FormField label={c.storeAmStart} htmlFor="am-start">
              <Input
                id="am-start"
                type="time"
                data-ocid="admin.store.am_start.input"
                className="touch-target"
                value={draft.amShiftStart}
                onChange={(event) => set("amShiftStart", event.target.value)}
              />
            </FormField>
            <FormField label={c.storeAmEnd} htmlFor="am-end">
              <Input
                id="am-end"
                type="time"
                data-ocid="admin.store.am_end.input"
                className="touch-target"
                value={draft.amShiftEnd}
                onChange={(event) => set("amShiftEnd", event.target.value)}
              />
            </FormField>
            <FormField label={c.storePmStart} htmlFor="pm-start">
              <Input
                id="pm-start"
                type="time"
                data-ocid="admin.store.pm_start.input"
                className="touch-target"
                value={draft.pmShiftStart}
                onChange={(event) => set("pmShiftStart", event.target.value)}
              />
            </FormField>
            <FormField label={c.storePmEnd} htmlFor="pm-end">
              <Input
                id="pm-end"
                type="time"
                data-ocid="admin.store.pm_end.input"
                className="touch-target"
                value={draft.pmShiftEnd}
                onChange={(event) => set("pmShiftEnd", event.target.value)}
              />
            </FormField>
          </div>
          <p className="text-xs text-muted-foreground">
            {fill(c.storeShiftsSummary, {
              am: `${formatTimeOfDay(inputToTimeOfDay(draft.amShiftStart))}–${formatTimeOfDay(inputToTimeOfDay(draft.amShiftEnd))}`,
              pm: `${formatTimeOfDay(inputToTimeOfDay(draft.pmShiftStart))}–${formatTimeOfDay(inputToTimeOfDay(draft.pmShiftEnd))}`,
            })}
          </p>
        </fieldset>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField label={c.storeLeaderTalkName} htmlFor="leader-talk-name">
            <Input
              id="leader-talk-name"
              data-ocid="admin.store.leader_talk_name.input"
              className="touch-target"
              value={draft.leaderTalkName}
              onChange={(event) => set("leaderTalkName", event.target.value)}
            />
          </FormField>
          <FormField
            label={c.storeTrainingGroupSize}
            htmlFor="training-group-size"
          >
            <Input
              id="training-group-size"
              type="number"
              min={1}
              data-ocid="admin.store.training_group_size.input"
              className="touch-target"
              value={draft.trainingGroupSize}
              onChange={(event) => set("trainingGroupSize", event.target.value)}
            />
          </FormField>
          <FormField label={c.storeLeaderTalkSize} htmlFor="leader-talk-size">
            <Input
              id="leader-talk-size"
              type="number"
              min={1}
              data-ocid="admin.store.leader_talk_size.input"
              className="touch-target"
              value={draft.leaderTalkSize}
              onChange={(event) => set("leaderTalkSize", event.target.value)}
            />
          </FormField>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            className="touch-target"
            data-ocid="admin.store.save_button"
            disabled={update.isPending}
          >
            {update.isPending ? (
              <Loader2
                className="mr-2 h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Save className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            {c.storeSave}
          </Button>
          {saved && (
            <p
              className="text-sm font-medium text-accent"
              data-ocid="admin.store.success_state"
            >
              {c.storeSaved}
            </p>
          )}
          {update.isError && (
            <p
              className="text-sm font-medium text-destructive"
              data-ocid="admin.store.error_state"
            >
              {c.storeSaveError}
            </p>
          )}
        </div>
      </form>
    </AdminSection>
  );
}
