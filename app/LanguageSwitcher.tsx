"use client";

import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/config";
import { useLocale } from "@/lib/i18n/use-locale";

export default function LanguageSwitcher({ variant = "plain" }: { variant?: "plain" | "pill" }) {
  const locale = useLocale();

  function change(next: Locale) {
    // Appelee uniquement depuis onClick (jamais pendant le rendu) : l'ecriture
    // sur document.cookie ici est sans risque, mais l'analyse statique du
    // lint ne distingue pas "rendu" de "gestionnaire d'evenement".
    // eslint-disable-next-line react-hooks/immutability
    document.cookie = `locale=${next}; path=/; max-age=31536000`;
    window.location.reload();
  }

  if (variant === "pill") {
    // Redesign 2026-08-10 : pastille segmentee du handoff design (ecran de
    // connexion). Contrairement a la pastille de la sidebar (voir
    // app/(app)/AppSidebar.tsx), celle-ci reste reellement fonctionnelle -
    // l'ecran de connexion a de vraies traductions (lib/i18n/dictionaries.ts).
    return (
      <div
        className="flex w-fit gap-1.5 rounded-full p-1"
        style={{ background: "var(--surface)" }}
      >
        {LOCALES.map((l) => {
          const active = l === locale;
          return (
            <button
              key={l}
              type="button"
              onClick={() => change(l)}
              aria-current={active}
              className="rounded-full px-3.5 py-1.5 text-xs font-bold"
              style={{
                background: active ? "var(--accent)" : "transparent",
                color: active ? "var(--on-accent)" : "var(--text-muted)",
                fontFamily: l === "ar" ? "var(--font-arabic)" : undefined,
              }}
            >
              {l === "ar" ? "العربية" : LOCALE_LABELS[l]}
            </button>
          );
        })}
      </div>
    );
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
            color: l === locale ? "var(--accent)" : "var(--ink-soft)",
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
