"use client";

import { useEffect, useState } from "react";

// Vrai etat hors-ligne (pas suppose) : verifie si cette page de lecon est
// effectivement dans le cache du service worker (public/sw.js, strategie
// network-first sur RUNTIME_CACHE pour les navigations /cours/*) plutot que
// d'afficher un badge "disponible hors-ligne" fixe qui mentirait tant que la
// premiere visite en ligne n'a pas eu lieu.
export default function OfflineBadge() {
  const [status, setStatus] = useState<"checking" | "available" | "unavailable">("checking");

  useEffect(() => {
    // Toute mise a jour d'etat passe par le .then()/.catch() de la chaine de
    // promesses (jamais un setState synchrone directement dans le corps de
    // l'effet, y compris pour le cas "caches indisponible") - regle reelle
    // du linter de ce depot (react-hooks/set-state-in-effect).
    Promise.resolve()
      .then(() => (typeof caches !== "undefined" ? caches.match(window.location.href) : null))
      .then((match) => setStatus(match ? "available" : "unavailable"))
      .catch(() => setStatus("unavailable"));
  }, []);

  if (status === "checking") return null;

  return (
    <span
      className="rounded-full px-[11px] py-[5px] text-[11.5px] font-bold"
      style={
        status === "available"
          ? { background: "var(--chip-bg)", color: "var(--accent)" }
          : { background: "var(--line)", color: "var(--text-muted)" }
      }
    >
      {status === "available" ? "Disponible hors-ligne" : "Non disponible hors-ligne"}
    </span>
  );
}
