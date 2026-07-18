export const LOCALES = ["fr", "en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";
export const RTL_LOCALES: readonly Locale[] = ["ar"];
export const LOCALE_LABELS: Record<Locale, string> = {
  fr: "FR",
  en: "EN",
  ar: "AR",
};

export function isRtl(locale: Locale): boolean {
  return RTL_LOCALES.includes(locale);
}

export function isValidLocale(value: string | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}
