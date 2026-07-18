import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isValidLocale, type Locale } from "./config";

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get("locale")?.value;
  return isValidLocale(value) ? value : DEFAULT_LOCALE;
}
