import { StoreLogo } from "@/components/StoreLogo";
import { useKioskCopy } from "@/components/kiosk/copy";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/utils";
import { ArrowRight, Camera, Clock, PenLine, UserRound } from "lucide-react";

const HIGHLIGHTS = [
  { icon: UserRound, key: "welcome.point1" },
  { icon: Camera, key: "welcome.point2" },
  { icon: Clock, key: "welcome.point3" },
  { icon: PenLine, key: "welcome.point4" },
] as const;

/** The kiosk landing screen: language switch and a single start action. */
export function KioskWelcome({ onStart }: { onStart: () => void }) {
  const { locale, setLocale } = useI18n();
  const t = useKioskCopy();

  return (
    <div
      className="mx-auto flex w-full max-w-2xl flex-col items-center gap-8 py-6 text-center"
      data-ocid="kiosk.welcome"
    >
      <fieldset
        className="flex items-center gap-1 rounded-full border border-border bg-card p-1"
        aria-label={t("lang.label")}
      >
        <legend className="sr-only">{t("lang.label")}</legend>
        {(["en", "es"] as const).map((code) => (
          <button
            key={code}
            type="button"
            data-ocid={`kiosk.lang.${code}`}
            aria-pressed={locale === code}
            onClick={() => setLocale(code)}
            className={cn(
              "touch-target rounded-full px-5 font-display text-sm font-semibold uppercase tracking-wider transition-colors",
              locale === code
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {code === "en" ? "English" : "Español"}
          </button>
        ))}
      </fieldset>

      <StoreLogo className="h-20 w-20" />

      <div className="space-y-3">
        <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-foreground md:text-5xl">
          {t("welcome.title")}
        </h1>
        <p className="mx-auto max-w-xl text-base text-muted-foreground md:text-lg">
          {t("welcome.body")}
        </p>
      </div>

      <ul className="grid w-full gap-3 text-left sm:grid-cols-2">
        {HIGHLIGHTS.map(({ icon: Icon, key }) => (
          <li
            key={key}
            className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 shadow-subtle"
          >
            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="text-sm text-foreground">{t(key)}</span>
          </li>
        ))}
      </ul>

      <Button
        type="button"
        size="lg"
        data-ocid="kiosk.start_button"
        onClick={onStart}
        className="touch-target h-14 w-full max-w-sm rounded-full px-8 font-display text-base font-semibold uppercase tracking-wider"
      >
        {t("welcome.start")}
        <ArrowRight className="h-5 w-5" aria-hidden="true" />
      </Button>

      <p className="max-w-md text-xs text-muted-foreground">
        {t("welcome.privacy")}
      </p>
    </div>
  );
}
