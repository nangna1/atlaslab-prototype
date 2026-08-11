"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

// Coquille responsive (2026-08-11, retour utilisateur reel sur telephone :
// la grille fixe 248px/1fr debordait a l'ecran, la sidebar prenait tout
// l'espace). En dessous du breakpoint `lg` (1024px, seuil Tailwind par
// defaut) : la sidebar devient un tiroir superpose (ouvert/ferme via un
// bouton menu dans une petite barre superieure), pas une colonne de grille.
// Au-dessus de `lg` : comportement desktop inchange (grille 248px/1fr).
export default function MobileShell({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Ferme le tiroir a chaque navigation - sinon il reste ouvert par-dessus
  // la nouvelle page apres avoir clique un lien de la sidebar sur mobile.
  // Pattern "ajuster l'etat pendant le rendu" (recommande par React plutot
  // qu'un useEffect pour reagir a un changement de prop/route - voir
  // react.dev "You Might Not Need an Effect") : setState appele ici est
  // sans risque, React le traite avant le commit puisque c'est conditionne
  // sur un changement reel detecte pendant le rendu, pas a chaque rendu.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  return (
    <div className="lg:grid lg:min-h-screen lg:grid-cols-[248px_1fr]">
      <div
        className="flex items-center gap-3 border-b px-4 py-3 lg:hidden"
        style={{ borderColor: "var(--line)", background: "var(--bg-panel)" }}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ouvrir le menu"
          aria-expanded={open}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ border: "1px solid var(--line)", color: "var(--text)" }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        <span className="text-sm font-bold" style={{ color: "var(--text)" }}>
          AtlasLab
        </span>
      </div>

      {/* Fond assombri (mobile uniquement) qui ferme le tiroir au clic. */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Tiroir mobile (position fixe, glisse depuis la gauche) / colonne
          desktop normale (position statique dans la grille). */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-[248px] transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebar}
      </div>

      <main className="min-w-0">{children}</main>
    </div>
  );
}
