import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6" style={{ background: "var(--background)" }}>
      <div className="card w-full max-w-sm text-center">
        <p className="text-2xl">📡</p>
        <h1 className="mt-2 text-lg font-semibold" style={{ color: "var(--ink)" }}>
          Vous êtes hors-ligne
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--ink-soft)" }}>
          Cette page n&apos;a pas encore été consultée avec une connexion active. Les leçons déjà
          ouvertes au moins une fois restent disponibles hors-ligne.
        </p>
        <Link href="/cours" className="btn-secondary mt-4 inline-block">
          Retour à mes cours
        </Link>
      </div>
    </main>
  );
}
