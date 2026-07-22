"use client";

import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/config";
import { useLocale } from "@/lib/i18n/use-locale";

export default function LanguageSwitcher() {
  const locale = useLocale();

  function change(next: Locale) {
    // Appelee uniquement depuis onClick (jamais pendant le rendu) : l'ecriture
    // sur document.cookie ici est sans risque, mais l'analyse statique du
    // lint ne distingue pas "rendu" de "gestionnaire d'evenement".
    // eslint-disable-next-line react-hooks/immutability
    document.cookie = `locale=${next}; path=/; max-age=31536000`;
    window.location.reload();
  }

  return (
    <div
      className="flex items-center gap-2"
      style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => change(l)}
          aria-current={l === locale}
          style={{
            fontWeight: l === locale ? 700 : 400,
            color: l === locale ? "var(--brand, #4f46e5)" : "var(--ink-soft)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          {LOCALE_LABELS[l]}
        </button>
      ))}
    </div>
  );
}
