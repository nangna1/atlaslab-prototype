// Composant labo réutilisable, validé le 17/07/2026 (voir
// app/labo-test-circuitverse/page.tsx pour le test d'intégration d'origine).
//
// Important : n'utiliser QUE des URLs de la forme
// https://circuitverse.org/simulator/embed/{slug} — la route générique
// /simulator seule bloque l'iframe (X-Frame-Options: SAMEORIGIN).
export default function LaboCircuitVerse({ embedUrl }: { embedUrl: string }) {
  return (
    <div className="card">
      <p className="mb-2 text-xs text-gray-500">Laboratoire de logique numérique (CircuitVerse)</p>
      <iframe
        src={embedUrl}
        title="CircuitVerse"
        width="100%"
        height="500"
        className="rounded-md border border-gray-200"
      />
    </div>
  );
}
