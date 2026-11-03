import { DemoRole, DemoShift, Role } from "@/backend";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRealAccessGrant } from "@/hooks/useAccess";
import { DEMO_ROLE_OPTIONS, useDemo } from "@/hooks/useDemo";
import { useI18n } from "@/hooks/useI18n";
import { usePositions } from "@/hooks/useQueries";
import {
  dateOnlyToInputValue,
  formatDateOnlyLong,
  inputValueToDateOnly,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { CalendarClock, Eye, Power, TriangleAlert } from "lucide-react";
import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

/**
 * Marks that a `DemoBannerHost` already renders the banner higher in the tree,
 * so a nested `DemoBanner` mount (in the app shell or a gate) renders nothing
 * instead of a second bar.
 */
const DemoBannerHosted = createContext(false);

/** The role label key for a demo role. */
function roleLabelKey(role: DemoRole): string {
  return `demo.banner.role.${role}`;
}

/** Placeholder shown in the "View as" picker before a demo role is chosen. */
const CHOOSE_ROLE_LABEL: Record<"en" | "es", string> = {
  en: "Choose a role",
  es: "Elige un rol",
};

/**
 * The "View as" picker: choose the caller's own impersonated demo role, and for
 * a demo NSO Trainer the stations that role may see. Any signed-in caller may
 * choose a demo role while demo mode is on; the choice is per-caller.
 */
function ViewAsPicker() {
  const { t, locale } = useI18n();
  const demo = useDemo();
  const { data: positions } = usePositions();
  const [open, setOpen] = useState(false);
  const [stations, setStations] = useState<bigint[]>(demo.demoTrainerStations);
  const chooseRole = CHOOSE_ROLE_LABEL[locale === "es" ? "es" : "en"];

  // Keep the local station draft in step with the backend state while the
  // popover is closed, so a change made elsewhere is reflected on reopen.
  useEffect(() => {
    if (!open) setStations(demo.demoTrainerStations);
  }, [open, demo.demoTrainerStations]);

  const isTrainer = demo.demoRole === DemoRole.trainer;

  const toggleStation = (id: bigint, checked: boolean) => {
    setStations((current) =>
      checked
        ? current.includes(id)
          ? current
          : [...current, id]
        : current.filter((value) => value !== id),
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-ocid="demo.view_as.open_button"
          className="touch-target gap-2 border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
        >
          <Eye className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">{t("demo.banner.viewAs")}:</span>
          <span className="font-semibold">
            {demo.demoRole ? t(roleLabelKey(demo.demoRole)) : chooseRole}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        data-ocid="demo.view_as.popover"
        className="w-72 space-y-3"
      >
        <div className="space-y-1.5">
          <Label htmlFor="demo-role-select">{t("demo.banner.viewAs")}</Label>
          <Select
            value={demo.demoRole ?? undefined}
            onValueChange={(value) => demo.setRole(value as DemoRole, stations)}
          >
            <SelectTrigger
              id="demo-role-select"
              data-ocid="demo.view_as.select"
              className="touch-target w-full"
            >
              <SelectValue placeholder={chooseRole} />
            </SelectTrigger>
            <SelectContent>
              {DEMO_ROLE_OPTIONS.map((option) => (
                <SelectItem
                  key={option.role}
                  value={option.role}
                  data-ocid={`demo.view_as.option.${option.role}`}
                >
                  {t(roleLabelKey(option.role))}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isTrainer && (
          <div className="space-y-2">
            <div>
              <p className="text-sm font-medium">{t("demo.banner.stations")}</p>
              <p className="text-xs text-muted-foreground">
                {t("demo.banner.stationsHint")}
              </p>
            </div>
            <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
              {(positions ?? []).map((position) => {
                const checked = stations.includes(position.id);
                return (
                  <label
                    key={position.id.toString()}
                    htmlFor={`demo-station-${position.id}`}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <Checkbox
                      id={`demo-station-${position.id}`}
                      checked={checked}
                      data-ocid={`demo.view_as.station.${position.id}`}
                      onCheckedChange={(value) =>
                        toggleStation(position.id, value === true)
                      }
                    />
                    <span className="min-w-0 truncate">{position.name}</span>
                  </label>
                );
              })}
              {(positions ?? []).length === 0 && (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">
                  {t("common.none")}
                </p>
              )}
            </div>
            <Button
              type="button"
              size="sm"
              data-ocid="demo.view_as.stations.save_button"
              className="touch-target w-full"
              disabled={demo.isPending}
              onClick={() => demo.setRole(DemoRole.trainer, stations)}
            >
              {t("common.save")}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * The "Pretend it's" picker: a date and an AM/PM shift that override "now" for
 * schedule windows, countdowns, the Today screen, check-in availability and age
 * math while demo mode is on.
 */
function PretendDatePicker() {
  const { t } = useI18n();
  const demo = useDemo();
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState("");
  const [shift, setShift] = useState<DemoShift>(DemoShift.am);

  useEffect(() => {
    if (!open) {
      setDay(
        demo.pretendDate ? dateOnlyToInputValue(demo.pretendDate.day) : "",
      );
      setShift(
        demo.pretendDate?.shift === DemoShift.pm ? DemoShift.pm : DemoShift.am,
      );
    }
  }, [open, demo.pretendDate]);

  const apply = () => {
    const dateOnly = inputValueToDateOnly(day);
    if (dateOnly === null) return;
    demo.setPretendDate({ day: dateOnly, shift });
    setOpen(false);
  };

  const clear = () => {
    demo.setPretendDate(null);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-ocid="demo.pretend.open_button"
          className="touch-target gap-2 border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
        >
          <CalendarClock className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">{t("demo.banner.pretend")}:</span>
          <span className="font-semibold">
            {demo.pretendDate
              ? `${formatDateOnlyLong(demo.pretendDate.day)} · ${demo.pretendDate.shift.toUpperCase()}`
              : t("demo.banner.now")}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        data-ocid="demo.pretend.popover"
        className="w-72 space-y-3"
      >
        <div className="space-y-1.5">
          <Label htmlFor="demo-pretend-date">{t("demo.banner.date")}</Label>
          <Input
            id="demo-pretend-date"
            type="date"
            value={day}
            data-ocid="demo.pretend.date_input"
            className="touch-target"
            onChange={(event) => setDay(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="demo-pretend-shift">{t("demo.banner.shift")}</Label>
          <Select
            value={shift}
            onValueChange={(value) =>
              setShift(value === DemoShift.pm ? DemoShift.pm : DemoShift.am)
            }
          >
            <SelectTrigger
              id="demo-pretend-shift"
              data-ocid="demo.pretend.shift_select"
              className="touch-target w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                value={DemoShift.am}
                data-ocid="demo.pretend.shift.am"
              >
                {t("demo.banner.am")}
              </SelectItem>
              <SelectItem
                value={DemoShift.pm}
                data-ocid="demo.pretend.shift.pm"
              >
                {t("demo.banner.pm")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-ocid="demo.pretend.clear_button"
            className="touch-target"
            disabled={demo.isPending}
            onClick={clear}
          >
            {t("demo.banner.now")}
          </Button>
          <Button
            type="button"
            size="sm"
            data-ocid="demo.pretend.apply_button"
            className="touch-target"
            disabled={demo.isPending || inputValueToDateOnly(day) === null}
            onClick={apply}
          >
            {t("common.save")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * The sticky demo-mode banner. Rendered above the app chrome on every screen
 * while demo mode is on: the app shell, the kiosk, the sign-in screen, the
 * waiting screen, the profile form and the error screen. It carries the
 * "Turn off" control (Admins only), the "View as" role picker and the
 * "Pretend it's" date picker, and shows the current pretend date and AM/PM.
 *
 * Renders nothing when demo mode is off, or when a `DemoBannerHost` higher in
 * the tree already renders the bar.
 */
export function DemoBanner() {
  const { t } = useI18n();
  const demo = useDemo();
  const realGrant = useRealAccessGrant();
  const hosted = useContext(DemoBannerHosted);
  const ref = useRef<HTMLElement>(null);

  // Publish the banner height so the app header can stick below it.
  useEffect(() => {
    if (!demo.enabled || hosted) return;
    const node = ref.current;
    if (!node) return;
    const apply = () => {
      document.documentElement.style.setProperty(
        "--demo-banner-h",
        `${node.offsetHeight}px`,
      );
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(node);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--demo-banner-h");
    };
  }, [demo.enabled, hosted]);

  if (!demo.enabled || hosted) return null;

  // Only a real Admin may turn demo mode off. The effective role while demo
  // mode is on is the chosen demo role, so the real grant is checked instead.
  const isAdmin = realGrant?.role === Role.admin;

  return (
    <section
      ref={ref}
      data-ocid="demo.banner"
      aria-label={t("demo.banner.label")}
      className={cn(
        "sticky top-0 z-50 w-full border-b border-black/20",
        "bg-[oklch(0.72_0.19_55)] text-[oklch(0.2_0.05_55)]",
      )}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 md:px-6">
        <p className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider">
          <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t("demo.banner.label")}</span>
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <ViewAsPicker />
          <PretendDatePicker />
          {isAdmin && (
            <Button
              type="button"
              size="sm"
              data-ocid="demo.turn_off_button"
              className="touch-target gap-2 bg-[oklch(0.2_0.05_55)] text-white hover:bg-[oklch(0.28_0.05_55)]"
              disabled={demo.isPending}
              onClick={() => demo.setEnabled(false, "")}
            >
              <Power className="h-4 w-4" aria-hidden="true" />
              {t("demo.banner.turnOff")}
            </Button>
          )}
        </div>
      </div>

      {demo.error && (
        <p
          role="alert"
          data-ocid="demo.banner.error_state"
          className="mx-auto w-full max-w-6xl px-4 pb-2 text-xs font-medium md:px-6"
        >
          {demo.error}
        </p>
      )}
    </section>
  );
}

/**
 * The single top-level banner mount. Renders the banner once and marks the
 * subtree as hosted so nested `DemoBanner` mounts in the app shell and the
 * access gates render nothing instead of a second bar.
 */
export function DemoBannerHost({ children }: { children: ReactNode }) {
  return (
    <>
      <DemoBanner />
      <DemoBannerHosted.Provider value={true}>
        {children}
      </DemoBannerHosted.Provider>
    </>
  );
}

/** The note shown where a real-settings control is hidden while demo is on. */
const DEMO_SETTINGS_NOTE: Record<"en" | "es", string> = {
  en: "Turn off demo mode to change real settings.",
  es: "Desactiva el modo demo para cambiar la configuración real.",
};

/**
 * The note shown in place of a real-settings control while demo mode is on.
 * Renders nothing while demo mode is off, so a panel can mount it
 * unconditionally and keep its normal controls when demo is off.
 */
export function DemoSettingsNote() {
  const { locale } = useI18n();
  const demo = useDemo();
  if (!demo.enabled) return null;
  return (
    <p
      data-ocid="demo.settings_note"
      className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
    >
      {DEMO_SETTINGS_NOTE[locale === "es" ? "es" : "en"]}
    </p>
  );
}
