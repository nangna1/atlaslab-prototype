// Composant labo réutilisable, validé le 17/07/2026 (voir
// app/labo-test-circuitverse/page.tsx pour le test d'intégration d'origine).
//
// Important : n'utiliser QUE des URLs de la forme
// https://circuitverse.org/simulator/embed/{slug} — la route générique
// /simulator seule bloque l'iframe (X-Frame-Options: SAMEORIGIN).
export default function LaboCircuitVerse({ embedUrl }: { embedUrl: string }) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 16 }}>
      <p style={{ fontSize: 13, color: "#666", marginTop: 0 }}>
        Laboratoire de logique numérique (CircuitVerse)
      </p>
      <iframe
        src={embedUrl}
        title="CircuitVerse"
        width="100%"
        height="500"
        style={{ border: "1px solid #ccc", borderRadius: 6 }}
      />
    </div>
  );
}
