import { type Locale, dictionaries } from "@/lib/copy";
import { createContext, useContext } from "react";

export interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** Translate a dotted key, interpolating `{name}` placeholders. */
  t: (key: string, vars?: Record<string, string | number>) => string;
}

export const I18nContext = createContext<I18nValue | null>(null);

export function translate(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const dict = dictionaries[locale] ?? dictionaries.en;
  let value = dict[key] ?? dictionaries.en[key] ?? key;
  if (vars) {
    for (const [name, replacement] of Object.entries(vars)) {
      value = value.replaceAll(`{${name}}`, String(replacement));
    }
  }
  return value;
}

/** Access the copy dictionary. Falls back to English outside a provider. */
export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  return {
    locale: "en",
    setLocale: () => {},
    t: (key, vars) => translate("en", key, vars),
  };
}
