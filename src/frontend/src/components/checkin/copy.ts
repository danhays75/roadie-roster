import { useI18n } from "@/hooks/useI18n";

/**
 * Check-in-local copy for keys the shared dictionary does not yet provide.
 * Kept beside the check-in components so the shared dictionary stays owned by
 * the foundation. Falls back to English for any locale without a translation.
 */
const checkInCopy: Record<string, { en: string; es: string }> = {
  "checkIn.lockedMessage": {
    en: "Locked: ask a manager to change.",
    es: "Bloqueado: pide a un gerente que lo cambie.",
  },
  "checkIn.lateTimeLabel": {
    en: "Late time",
    es: "Hora de llegada tarde",
  },
  "checkIn.lateTimeHint": {
    en: "Adjust the time the roadie arrived.",
    es: "Ajusta la hora a la que llegó el roadie.",
  },
  "checkIn.lateTimeSave": {
    en: "Save time",
    es: "Guardar hora",
  },
  "checkIn.lateTimeSaved": {
    en: "Time saved.",
    es: "Hora guardada.",
  },
  "checkIn.lateTimeInvalid": {
    en: "Enter a valid time.",
    es: "Introduce una hora válida.",
  },
  "checkIn.saving": {
    en: "Saving…",
    es: "Guardando…",
  },
  "checkIn.rowLabel": {
    en: "{name}, {state}",
    es: "{name}, {state}",
  },
  "checkIn.photoAlt": {
    en: "Roadie photo",
    es: "Foto del roadie",
  },
  "checkIn.retry": {
    en: "Retry",
    es: "Reintentar",
  },
};

function interpolate(
  template: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return template;
  let value = template;
  for (const [name, replacement] of Object.entries(vars)) {
    value = value.replaceAll(`{${name}}`, String(replacement));
  }
  return value;
}

/**
 * Translate a check-in key, preferring the shared dictionary and falling back
 * to the check-in-local copy for keys the foundation has not defined.
 */
export function useCheckInCopy() {
  const { locale, t } = useI18n();
  return {
    t: (key: string, vars?: Record<string, string | number>) => {
      const entry = checkInCopy[key];
      if (entry) {
        return interpolate(locale === "es" ? entry.es : entry.en, vars);
      }
      return t(key, vars);
    },
  };
}
