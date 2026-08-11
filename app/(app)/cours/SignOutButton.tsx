"use client";

import { DEMO_RETURN_LINK_KEY } from "@/lib/demo-session";

export default function SignOutButton({ action }: { action: () => void }) {
  return (
    <form
      action={action}
      onSubmit={() => {
        // Purge le cache hors-ligne (leçons /cours/*) avant de changer de compte,
        // sinon un autre utilisateur sur le même appareil pourrait voir hors-ligne
        // une page mise en cache pour la session précédente.
        navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_RUNTIME_CACHE" });
        // Idem pour un lien de retour "Se connecter en tant que" resté en
        // attente : ne doit pas survivre à une vraie déconnexion.
        sessionStorage.removeItem(DEMO_RETURN_LINK_KEY);
      }}
    >
      <button type="submit" className="btn-link" style={{ color: "var(--ink-soft)" }}>
        Se déconnecter
      </button>
    </form>
  );
}
