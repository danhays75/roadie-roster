import { Role, type StaffProfile } from "@/backend";
import { FormField } from "@/components/admin/FormField";
import { TrainerStationsPicker } from "@/components/approvals/TrainerStationsPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/hooks/useI18n";
import { usePositions } from "@/hooks/useQueries";
import {
  dateOnlyToDate,
  dateToDateOnly,
  fileToRef,
  refToDataUrl,
  resizeImageFile,
} from "@/lib/format";
import { Loader2, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";

/**
 * The roles a staff member may request on their profile. The list is the
 * accepted set: Store Manager, Training Manager, NSO Trainer, Visiting Manager,
 * Market Partner/Leadership and Store tablet (kiosk).
 */
const ROLE_OPTIONS: Role[] = [
  Role.storeManager,
  Role.trainingManager,
  Role.trainer,
  Role.visitingManager,
  Role.leadership,
  Role.kiosk,
];

/** Roles that must supply the positions they train and their travel dates. */
const TRAVEL_ROLES: Role[] = [Role.trainer, Role.visitingManager];

/**
 * The Store tablet (kiosk) role skips the rest of the form: no other fields are
 * shown or validated, and submitting sends a pending request with this role.
 */
const KIOSK_ROLE: Role = Role.kiosk;

/** Shirt sizes offered on the About Me section, matching the kiosk. */
const SHIRT_SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL"] as const;

/** Hat sizes offered on the About Me section, with a copy key per option. */
const HAT_SIZES = [
  { value: "One size", key: "profile.hat.oneSize" },
  { value: "S/M", key: "profile.hat.sm" },
  { value: "L/XL", key: "profile.hat.lxl" },
] as const;

/** A `YYYY-MM-DD` value for a date input, read in UTC. */
function dateOnlyToInput(value: bigint | undefined): string {
  if (value === undefined) return "";
  const date = dateOnlyToDate(value);
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

/** The editable draft of a staff profile, held as strings for the inputs. */
interface Draft {
  fullName: string;
  preferredName: string;
  title: string;
  requestedRole: Role | "";
  homeStoreNumber: string;
  homeStoreCity: string;
  workPhone: string;
  workEmail: string;
  arrivalDate: string;
  departureDate: string;
  trainerPositionIds: string[];
  photo: Uint8Array | null;
  hometown: string;
  hobbies: string;
  favoriteTeam: string;
  favoriteSnack: string;
  favoriteDrink: string;
  favoriteColor: string;
  funFact: string;
  goalHere: string;
  shirtSize: string;
  hatSize: string;
}

function toDraft(profile: StaffProfile | undefined): Draft {
  return {
    fullName: profile?.fullName ?? "",
    preferredName: profile?.preferredName ?? "",
    title: profile?.title ?? "",
    requestedRole: profile?.requestedRole ?? "",
    homeStoreNumber: profile?.homeStoreNumber ?? "",
    homeStoreCity: profile?.homeStoreCity ?? "",
    workPhone: profile?.workPhone ?? "",
    workEmail: profile?.workEmail ?? "",
    arrivalDate: dateOnlyToInput(profile?.arrivalDate),
    departureDate: dateOnlyToInput(profile?.departureDate),
    trainerPositionIds: (profile?.trainerPositionIds ?? []).map((id) =>
      id.toString(),
    ),
    photo: profile?.photo ?? null,
    hometown: profile?.hometown ?? "",
    hobbies: profile?.hobbies ?? "",
    favoriteTeam: profile?.favoriteTeam ?? "",
    favoriteSnack: profile?.favoriteSnack ?? "",
    favoriteDrink: profile?.favoriteDrink ?? "",
    favoriteColor: profile?.favoriteColor ?? "",
    funFact: profile?.funFact ?? "",
    goalHere: profile?.goalHere ?? "",
    shirtSize: profile?.shirtSize ?? "",
    hatSize: profile?.hatSize ?? "",
  };
}

/** Trim a value to `undefined` when blank, so optional fields stay absent. */
function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * Detect an image's real MIME type from its leading bytes. A stored photo is
 * raw bytes with no content type, so the preview's data URL must be built from
 * the actual format rather than assuming JPEG: a seeded staff profile photo may
 * be PNG or WebP. Recognizes PNG, JPEG and WebP; falls back to `image/jpeg`.
 */
function detectImageMimeType(bytes: Uint8Array): string {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return "image/jpeg";
}

/** The maximum length of an About Me answer, matching the kiosk's cap. */
const ABOUT_ME_MAX = 200;

/** Trim and cap an optional About Me answer, dropping it when blank. */
function optionalCapped(value: string): string | undefined {
  const trimmed = value.trim().slice(0, ABOUT_ME_MAX);
  return trimmed === "" ? undefined : trimmed;
}

/** Build the backend `StaffProfile` from the draft, dropping blank optionals. */
function toProfile(draft: Draft): StaffProfile {
  const travels =
    draft.requestedRole !== "" && TRAVEL_ROLES.includes(draft.requestedRole);
  return {
    fullName: draft.fullName.trim(),
    preferredName: optional(draft.preferredName),
    title: draft.title.trim(),
    requestedRole: draft.requestedRole as Role,
    homeStoreNumber: draft.homeStoreNumber.trim(),
    homeStoreCity: draft.homeStoreCity.trim(),
    workPhone: optional(draft.workPhone),
    workEmail: optional(draft.workEmail),
    trainerPositionIds: travels
      ? draft.trainerPositionIds.map((id) => BigInt(id))
      : [],
    arrivalDate:
      travels && draft.arrivalDate
        ? dateToDateOnly(new Date(`${draft.arrivalDate}T00:00:00Z`))
        : undefined,
    departureDate:
      travels && draft.departureDate
        ? dateToDateOnly(new Date(`${draft.departureDate}T00:00:00Z`))
        : undefined,
    photo: draft.photo ?? undefined,
    hometown: optionalCapped(draft.hometown),
    hobbies: optionalCapped(draft.hobbies),
    favoriteTeam: optionalCapped(draft.favoriteTeam),
    favoriteSnack: optionalCapped(draft.favoriteSnack),
    favoriteDrink: optionalCapped(draft.favoriteDrink),
    favoriteColor: optionalCapped(draft.favoriteColor),
    funFact: optionalCapped(draft.funFact),
    goalHere: optionalCapped(draft.goalHere),
    shirtSize: optional(draft.shirtSize),
    hatSize: optional(draft.hatSize),
  };
}

/**
 * The staff profile form, shared by the post-sign-in gate and the My profile
 * page. It owns its draft in local state and hands a complete `StaffProfile` to
 * `onSubmit`; the caller owns the mutation and its pending/error state.
 */
export function StaffProfileForm({
  initialProfile,
  submitLabel,
  pending,
  error,
  onSubmit,
  ocidPrefix = "profile",
}: {
  initialProfile?: StaffProfile;
  submitLabel: string;
  pending: boolean;
  error?: string | null;
  onSubmit: (profile: StaffProfile) => void;
  ocidPrefix?: string;
}) {
  const { t } = useI18n();
  const { data: positions } = usePositions();
  const [draft, setDraft] = useState<Draft>(() => toDraft(initialProfile));
  const [validation, setValidation] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setValidation(null);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const travels =
    draft.requestedRole !== "" && TRAVEL_ROLES.includes(draft.requestedRole);

  const isKiosk = draft.requestedRole === KIOSK_ROLE;

  const handlePhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoBusy(true);
    try {
      const resized = await resizeImageFile(file);
      const ref = await fileToRef(resized);
      set("photo", ref);
    } finally {
      setPhotoBusy(false);
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (draft.requestedRole === "") {
      setValidation(t("profile.role.required"));
      return;
    }
    if (!isKiosk) {
      if (!draft.fullName.trim()) {
        setValidation(t("profile.fullName.required"));
        return;
      }
      if (!draft.title.trim()) {
        setValidation(t("profile.title.required"));
        return;
      }
      if (!draft.homeStoreNumber.trim()) {
        setValidation(t("profile.homeStoreNumber.required"));
        return;
      }
      if (!draft.homeStoreCity.trim()) {
        setValidation(t("profile.homeStoreCity.required"));
        return;
      }
    }
    setValidation(null);
    onSubmit(toProfile(draft));
  };

  const message = validation ?? error ?? null;
  // The preview shows the seeded staff profile photo (or a freshly uploaded
  // one) using its real image type, so a non-JPEG stored photo still renders.
  const photoPreview = draft.photo
    ? refToDataUrl(draft.photo, detectImageMimeType(draft.photo))
    : null;

  return (
    <form
      onSubmit={submit}
      data-ocid={`${ocidPrefix}.form`}
      className="flex flex-col gap-4"
    >
      <FormField label={t("profile.role.label")} htmlFor={`${ocidPrefix}-role`}>
        <Select
          value={draft.requestedRole}
          onValueChange={(value) => set("requestedRole", value as Role)}
        >
          <SelectTrigger
            id={`${ocidPrefix}-role`}
            data-ocid={`${ocidPrefix}.role.select`}
            className="touch-target w-full"
          >
            <SelectValue placeholder={t("profile.role.placeholder")} />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((role) => (
              <SelectItem key={role} value={role}>
                {t(`profile.role.${role}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      {!isKiosk && (
        <>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt={t("profile.photo.alt")}
                  data-ocid={`${ocidPrefix}.photo.preview`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Upload
                  className="h-6 w-6 text-muted-foreground"
                  aria-hidden="true"
                />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                data-ocid={`${ocidPrefix}.photo.input`}
                onChange={(event) => void handlePhoto(event.target.files?.[0])}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="touch-target"
                  data-ocid={`${ocidPrefix}.photo.upload_button`}
                  disabled={photoBusy}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {photoBusy && (
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  )}
                  {draft.photo
                    ? t("profile.photo.change")
                    : t("profile.photo.add")}
                </Button>
                {draft.photo && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="touch-target text-destructive hover:text-destructive"
                    data-ocid={`${ocidPrefix}.photo.remove_button`}
                    onClick={() => set("photo", null)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                    {t("profile.photo.remove")}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("profile.photo.hint")}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label={t("profile.fullName")}
              htmlFor={`${ocidPrefix}-full-name`}
            >
              <Input
                id={`${ocidPrefix}-full-name`}
                value={draft.fullName}
                data-ocid={`${ocidPrefix}.full_name.input`}
                className="touch-target"
                placeholder={t("profile.fullName.placeholder")}
                onChange={(event) => set("fullName", event.target.value)}
              />
            </FormField>

            <FormField
              label={t("profile.preferredName")}
              htmlFor={`${ocidPrefix}-preferred-name`}
            >
              <Input
                id={`${ocidPrefix}-preferred-name`}
                value={draft.preferredName}
                data-ocid={`${ocidPrefix}.preferred_name.input`}
                className="touch-target"
                placeholder={t("profile.preferredName.placeholder")}
                onChange={(event) => set("preferredName", event.target.value)}
              />
            </FormField>

            <FormField
              label={t("profile.title.label")}
              htmlFor={`${ocidPrefix}-title`}
            >
              <Input
                id={`${ocidPrefix}-title`}
                value={draft.title}
                data-ocid={`${ocidPrefix}.title.input`}
                className="touch-target"
                placeholder={t("profile.title.placeholder")}
                onChange={(event) => set("title", event.target.value)}
              />
            </FormField>

            <FormField
              label={t("profile.homeStoreNumber")}
              htmlFor={`${ocidPrefix}-store-number`}
            >
              <Input
                id={`${ocidPrefix}-store-number`}
                value={draft.homeStoreNumber}
                data-ocid={`${ocidPrefix}.home_store_number.input`}
                className="touch-target"
                placeholder={t("profile.homeStoreNumber.placeholder")}
                onChange={(event) => set("homeStoreNumber", event.target.value)}
              />
            </FormField>

            <FormField
              label={t("profile.homeStoreCity")}
              htmlFor={`${ocidPrefix}-store-city`}
            >
              <Input
                id={`${ocidPrefix}-store-city`}
                value={draft.homeStoreCity}
                data-ocid={`${ocidPrefix}.home_store_city.input`}
                className="touch-target"
                placeholder={t("profile.homeStoreCity.placeholder")}
                onChange={(event) => set("homeStoreCity", event.target.value)}
              />
            </FormField>

            <FormField
              label={t("profile.workPhone")}
              htmlFor={`${ocidPrefix}-work-phone`}
            >
              <Input
                id={`${ocidPrefix}-work-phone`}
                type="tel"
                value={draft.workPhone}
                data-ocid={`${ocidPrefix}.work_phone.input`}
                className="touch-target"
                placeholder={t("profile.workPhone.placeholder")}
                onChange={(event) => set("workPhone", event.target.value)}
              />
            </FormField>

            <FormField
              label={t("profile.workEmail")}
              htmlFor={`${ocidPrefix}-work-email`}
            >
              <Input
                id={`${ocidPrefix}-work-email`}
                type="email"
                value={draft.workEmail}
                data-ocid={`${ocidPrefix}.work_email.input`}
                className="touch-target"
                placeholder={t("profile.workEmail.placeholder")}
                onChange={(event) => set("workEmail", event.target.value)}
              />
            </FormField>
          </div>

          {travels && (
            <div className="flex flex-col gap-4 rounded-md border border-border bg-muted/30 p-4">
              <TrainerStationsPicker
                positions={positions ?? []}
                selectedIds={draft.trainerPositionIds}
                onChange={(next) => set("trainerPositionIds", next)}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label={t("profile.arrivalDate")}
                  htmlFor={`${ocidPrefix}-arrival`}
                >
                  <Input
                    id={`${ocidPrefix}-arrival`}
                    type="date"
                    value={draft.arrivalDate}
                    data-ocid={`${ocidPrefix}.arrival_date.input`}
                    className="touch-target"
                    onChange={(event) => set("arrivalDate", event.target.value)}
                  />
                </FormField>

                <FormField
                  label={t("profile.departureDate")}
                  htmlFor={`${ocidPrefix}-departure`}
                >
                  <Input
                    id={`${ocidPrefix}-departure`}
                    type="date"
                    value={draft.departureDate}
                    data-ocid={`${ocidPrefix}.departure_date.input`}
                    className="touch-target"
                    onChange={(event) =>
                      set("departureDate", event.target.value)
                    }
                  />
                </FormField>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {t("profile.contactHint")}
          </p>

          <fieldset
            data-ocid={`${ocidPrefix}.about_me.section`}
            className="flex flex-col gap-4 rounded-md border border-border bg-muted/30 p-4"
          >
            <legend className="px-1 font-display text-sm font-semibold uppercase tracking-wide text-foreground">
              {t("profile.aboutMe")}
            </legend>
            <p className="text-xs text-muted-foreground">
              {t("profile.aboutMe.hint")}
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label={t("profile.hometown")}
                htmlFor={`${ocidPrefix}-hometown`}
              >
                <Input
                  id={`${ocidPrefix}-hometown`}
                  value={draft.hometown}
                  maxLength={ABOUT_ME_MAX}
                  data-ocid={`${ocidPrefix}.hometown.input`}
                  className="touch-target"
                  onChange={(event) => set("hometown", event.target.value)}
                />
              </FormField>

              <FormField
                label={t("profile.favoriteTeam")}
                htmlFor={`${ocidPrefix}-favorite-team`}
              >
                <Input
                  id={`${ocidPrefix}-favorite-team`}
                  value={draft.favoriteTeam}
                  maxLength={ABOUT_ME_MAX}
                  data-ocid={`${ocidPrefix}.favorite_team.input`}
                  className="touch-target"
                  placeholder={t("profile.favoriteTeam.placeholder")}
                  onChange={(event) => set("favoriteTeam", event.target.value)}
                />
              </FormField>

              <FormField
                label={t("profile.favoriteSnack")}
                htmlFor={`${ocidPrefix}-favorite-snack`}
              >
                <Input
                  id={`${ocidPrefix}-favorite-snack`}
                  value={draft.favoriteSnack}
                  maxLength={ABOUT_ME_MAX}
                  data-ocid={`${ocidPrefix}.favorite_snack.input`}
                  className="touch-target"
                  placeholder={t("profile.favoriteSnack.placeholder")}
                  onChange={(event) => set("favoriteSnack", event.target.value)}
                />
              </FormField>

              <FormField
                label={t("profile.favoriteDrink")}
                htmlFor={`${ocidPrefix}-favorite-drink`}
              >
                <Input
                  id={`${ocidPrefix}-favorite-drink`}
                  value={draft.favoriteDrink}
                  maxLength={ABOUT_ME_MAX}
                  data-ocid={`${ocidPrefix}.favorite_drink.input`}
                  className="touch-target"
                  placeholder={t("profile.favoriteDrink.placeholder")}
                  onChange={(event) => set("favoriteDrink", event.target.value)}
                />
              </FormField>

              <FormField
                label={t("profile.favoriteColor")}
                htmlFor={`${ocidPrefix}-favorite-color`}
              >
                <Input
                  id={`${ocidPrefix}-favorite-color`}
                  value={draft.favoriteColor}
                  maxLength={ABOUT_ME_MAX}
                  data-ocid={`${ocidPrefix}.favorite_color.input`}
                  className="touch-target"
                  placeholder={t("profile.favoriteColor.placeholder")}
                  onChange={(event) => set("favoriteColor", event.target.value)}
                />
              </FormField>

              <FormField
                label={t("profile.shirtSize")}
                htmlFor={`${ocidPrefix}-shirt-size`}
              >
                <Select
                  value={draft.shirtSize || undefined}
                  onValueChange={(value) => set("shirtSize", value)}
                >
                  <SelectTrigger
                    id={`${ocidPrefix}-shirt-size`}
                    data-ocid={`${ocidPrefix}.shirt_size.select`}
                    className="touch-target w-full"
                  >
                    <SelectValue placeholder={t("profile.selectPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {SHIRT_SIZES.map((size) => (
                      <SelectItem key={size} value={size}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField
                label={t("profile.hatSize")}
                htmlFor={`${ocidPrefix}-hat-size`}
              >
                <Select
                  value={draft.hatSize || undefined}
                  onValueChange={(value) => set("hatSize", value)}
                >
                  <SelectTrigger
                    id={`${ocidPrefix}-hat-size`}
                    data-ocid={`${ocidPrefix}.hat_size.select`}
                    className="touch-target w-full"
                  >
                    <SelectValue placeholder={t("profile.selectPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {HAT_SIZES.map((size) => (
                      <SelectItem key={size.value} value={size.value}>
                        {t(size.key)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            <FormField
              label={t("profile.hobbies")}
              htmlFor={`${ocidPrefix}-hobbies`}
            >
              <Textarea
                id={`${ocidPrefix}-hobbies`}
                value={draft.hobbies}
                maxLength={ABOUT_ME_MAX}
                rows={2}
                data-ocid={`${ocidPrefix}.hobbies.textarea`}
                onChange={(event) => set("hobbies", event.target.value)}
              />
            </FormField>

            <FormField
              label={t("profile.funFact")}
              htmlFor={`${ocidPrefix}-fun-fact`}
            >
              <Textarea
                id={`${ocidPrefix}-fun-fact`}
                value={draft.funFact}
                maxLength={ABOUT_ME_MAX}
                rows={2}
                data-ocid={`${ocidPrefix}.fun_fact.textarea`}
                onChange={(event) => set("funFact", event.target.value)}
              />
            </FormField>

            <FormField
              label={t("profile.goalHere")}
              htmlFor={`${ocidPrefix}-goal-here`}
            >
              <Textarea
                id={`${ocidPrefix}-goal-here`}
                value={draft.goalHere}
                maxLength={ABOUT_ME_MAX}
                rows={3}
                data-ocid={`${ocidPrefix}.goal_here.textarea`}
                onChange={(event) => set("goalHere", event.target.value)}
              />
            </FormField>
          </fieldset>
        </>
      )}

      {message && (
        <p
          role="alert"
          data-ocid={`${ocidPrefix}.error_state`}
          className="text-sm font-medium text-destructive"
        >
          {message}
        </p>
      )}

      <div className="flex justify-end">
        <Button
          type="submit"
          className="touch-target"
          data-ocid={`${ocidPrefix}.submit_button`}
          disabled={pending || photoBusy}
        >
          {pending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
