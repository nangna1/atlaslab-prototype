"use client";

import { useEffect, useState } from "react";
import { DEFAULT_LOCALE, isValidLocale, type Locale } from "./config";

function readCookieLocale(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const match = document.cookie.match(/(?:^|; )locale=([^;]+)/);
  const value = match ? decodeURIComponent(match[1]) : undefined;
  return isValidLocale(value) ? value : DEFAULT_LOCALE;
}

export function useLocale(): Locale {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  useEffect(() => {
    // document.cookie n'existe pas cote serveur (SSR) : impossible de
    // calculer cette valeur autrement qu'apres montage cote client.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocale(readCookieLocale());
  }, []);
  return locale;
}
