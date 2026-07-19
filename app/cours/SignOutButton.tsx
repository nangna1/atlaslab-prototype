"use client";

export default function SignOutButton({ action }: { action: () => void }) {
  return (
    <form
      action={action}
      onSubmit={() => {
        // Purge le cache hors-ligne (leçons /cours/*) avant de changer de compte,
        // sinon un autre utilisateur sur le même appareil pourrait voir hors-ligne
        // une page mise en cache pour la session précédente.
        navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_RUNTIME_CACHE" });
      }}
    >
      <button type="submit" className="btn-link" style={{ color: "var(--ink-soft)" }}>
        Se déconnecter
      </button>
    </form>
  );
}
