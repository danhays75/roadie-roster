import { KioskField } from "@/components/kiosk/KioskField";
import { useKioskCopy } from "@/components/kiosk/copy";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface KioskDetails {
  name: string;
  preferredName: string;
  hometown: string;
  hobbies: string;
  favoriteMovie: string;
  favoriteSnack: string;
  funFact: string;
  goalHere: string;
  positionAppliedFor: string;
  shirtSize: string;
  hatSize: string;
  shiftsWantedPerWeek: string;
  weekdayLunch: "" | "yes" | "no";
}

export const EMPTY_DETAILS: KioskDetails = {
  name: "",
  preferredName: "",
  hometown: "",
  hobbies: "",
  favoriteMovie: "",
  favoriteSnack: "",
  funFact: "",
  goalHere: "",
  positionAppliedFor: "",
  shirtSize: "",
  hatSize: "",
  shiftsWantedPerWeek: "",
  weekdayLunch: "",
};

const SHIRT_SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL"] as const;
const HAT_SIZES = ["One size", "S/M", "L/XL"] as const;

/** Details step: identity, personality and role preferences. */
export function KioskDetailsStep({
  value,
  onChange,
  errors,
}: {
  value: KioskDetails;
  onChange: (next: KioskDetails) => void;
  errors: Partial<Record<keyof KioskDetails, string>>;
}) {
  const t = useKioskCopy();
  const set = <K extends keyof KioskDetails>(key: K, next: KioskDetails[K]) => {
    onChange({ ...value, [key]: next });
  };

  return (
    <div className="space-y-6" data-ocid="kiosk.details_step">
      <div className="space-y-1">
        <h2 className="font-display text-2xl font-bold uppercase tracking-tight">
          {t("details.title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("details.body")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <KioskField
          id="kiosk-name"
          label={t("field.name")}
          required
          error={errors.name}
        >
          <Input
            id="kiosk-name"
            data-ocid="kiosk.name.input"
            value={value.name}
            autoComplete="name"
            aria-invalid={!!errors.name}
            onChange={(e) => set("name", e.target.value)}
            className="touch-target"
          />
        </KioskField>

        <KioskField
          id="kiosk-preferred"
          label={t("field.preferredName")}
          hint={t("field.preferredNameHint")}
        >
          <Input
            id="kiosk-preferred"
            data-ocid="kiosk.preferred_name.input"
            value={value.preferredName}
            onChange={(e) => set("preferredName", e.target.value)}
            className="touch-target"
          />
        </KioskField>

        <KioskField id="kiosk-hometown" label={t("field.hometown")}>
          <Input
            id="kiosk-hometown"
            data-ocid="kiosk.hometown.input"
            value={value.hometown}
            onChange={(e) => set("hometown", e.target.value)}
            className="touch-target"
          />
        </KioskField>

        <KioskField
          id="kiosk-position"
          label={t("field.position")}
          required
          error={errors.positionAppliedFor}
        >
          <Input
            id="kiosk-position"
            data-ocid="kiosk.position.input"
            value={value.positionAppliedFor}
            placeholder={t("field.positionPlaceholder")}
            aria-invalid={!!errors.positionAppliedFor}
            onChange={(e) => set("positionAppliedFor", e.target.value)}
            className="touch-target"
          />
        </KioskField>

        <KioskField id="kiosk-shirt" label={t("field.shirtSize")}>
          <Select
            value={value.shirtSize || undefined}
            onValueChange={(next) => set("shirtSize", next)}
          >
            <SelectTrigger
              id="kiosk-shirt"
              data-ocid="kiosk.shirt_size.select"
              className="touch-target w-full"
            >
              <SelectValue placeholder={t("field.selectPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {SHIRT_SIZES.map((size) => (
                <SelectItem key={size} value={size}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </KioskField>

        <KioskField id="kiosk-hat" label={t("field.hatSize")}>
          <Select
            value={value.hatSize || undefined}
            onValueChange={(next) => set("hatSize", next)}
          >
            <SelectTrigger
              id="kiosk-hat"
              data-ocid="kiosk.hat_size.select"
              className="touch-target w-full"
            >
              <SelectValue placeholder={t("field.selectPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {HAT_SIZES.map((size) => (
                <SelectItem key={size} value={size}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </KioskField>

        <KioskField
          id="kiosk-shifts"
          label={t("field.shiftsWanted")}
          hint={t("field.shiftsWantedHint")}
        >
          <Input
            id="kiosk-shifts"
            data-ocid="kiosk.shifts_wanted.input"
            type="number"
            inputMode="numeric"
            min={0}
            max={14}
            value={value.shiftsWantedPerWeek}
            onChange={(e) => set("shiftsWantedPerWeek", e.target.value)}
            className="touch-target"
          />
        </KioskField>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="font-display text-sm uppercase tracking-wide">
            {t("field.weekdayLunch")}
          </legend>
          <div className="flex gap-2">
            {(["yes", "no"] as const).map((choice) => (
              <button
                key={choice}
                type="button"
                data-ocid={`kiosk.weekday_lunch.${choice}`}
                aria-pressed={value.weekdayLunch === choice}
                onClick={() => set("weekdayLunch", choice)}
                className={cn(
                  "touch-target flex-1 rounded-md border px-4 font-display text-sm font-semibold uppercase tracking-wider transition-colors",
                  value.weekdayLunch === choice
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-card text-foreground hover:bg-muted",
                )}
              >
                {choice === "yes" ? t("common.yes") : t("common.no")}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("field.weekdayLunchHint")}
          </p>
        </fieldset>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <KioskField id="kiosk-hobbies" label={t("field.hobbies")}>
          <Textarea
            id="kiosk-hobbies"
            data-ocid="kiosk.hobbies.textarea"
            value={value.hobbies}
            rows={2}
            onChange={(e) => set("hobbies", e.target.value)}
          />
        </KioskField>

        <KioskField id="kiosk-movie" label={t("field.favoriteMovie")}>
          <Textarea
            id="kiosk-movie"
            data-ocid="kiosk.favorite_movie.textarea"
            value={value.favoriteMovie}
            rows={2}
            onChange={(e) => set("favoriteMovie", e.target.value)}
          />
        </KioskField>

        <KioskField id="kiosk-snack" label={t("field.favoriteSnack")}>
          <Textarea
            id="kiosk-snack"
            data-ocid="kiosk.favorite_snack.textarea"
            value={value.favoriteSnack}
            rows={2}
            onChange={(e) => set("favoriteSnack", e.target.value)}
          />
        </KioskField>

        <KioskField id="kiosk-funfact" label={t("field.funFact")}>
          <Textarea
            id="kiosk-funfact"
            data-ocid="kiosk.fun_fact.textarea"
            value={value.funFact}
            rows={2}
            onChange={(e) => set("funFact", e.target.value)}
          />
        </KioskField>
      </div>

      <KioskField id="kiosk-goal" label={t("field.goalHere")}>
        <Textarea
          id="kiosk-goal"
          data-ocid="kiosk.goal_here.textarea"
          value={value.goalHere}
          rows={3}
          onChange={(e) => set("goalHere", e.target.value)}
        />
      </KioskField>
    </div>
  );
}
