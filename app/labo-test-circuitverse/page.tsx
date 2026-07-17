export default function LaboTestCircuitVerse() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Test d'intégration — CircuitVerse (logique numérique)</h1>
      <p>
        Circuit CircuitVerse public embarqué directement via iframe, sans aucun développement
        de simulateur propre — validation de la section 4.1 de l&apos;architecture technique AtlasLab.
      </p>
      <iframe
        src="https://circuitverse.org/simulator/embed/sample-embed"
        title="CircuitVerse embed test"
        width="100%"
        height="600"
        style={{ border: "1px solid #ccc", borderRadius: 8 }}
      />
    </main>
  );
}
