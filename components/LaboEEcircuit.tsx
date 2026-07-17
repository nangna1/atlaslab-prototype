"use client";

import { useState } from "react";
import { Simulation } from "eecircuit-engine";

// Composant labo réutilisable, validé le 17/07/2026 (voir
// app/labo-test-eecircuit/page.tsx pour le test d'intégration d'origine).
export default function LaboEEcircuit({ netlist }: { netlist: string }) {
  const [status, setStatus] = useState("Prêt.");
  const [ran, setRan] = useState(false);

  async function runTest() {
    setStatus("Chargement du moteur de simulation...");
    try {
      const sim = new Simulation();
      await sim.start();
      sim.setNetList(netlist);
      const res = await sim.runSim();
      setStatus(`Simulation terminée — ${res.dataType}, ${res.numPoints} points calculés.`);
      setRan(true);
    } catch (err) {
      setStatus("Erreur : " + String(err));
    }
  }

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 16 }}>
      <p style={{ fontSize: 13, color: "#666", marginTop: 0 }}>
        Laboratoire de simulation électronique (ngspice-WASM, 100% navigateur)
      </p>
      <pre style={{ background: "#f5f5f5", padding: 10, fontSize: 12, overflow: "auto" }}>
        {netlist}
      </pre>
      <button onClick={runTest} style={{ padding: "8px 16px" }}>
        Lancer la simulation
      </button>
      <p style={{ fontSize: 13 }}>
        <b>Statut :</b> {status} {ran && "✅"}
      </p>
    </div>
  );
}
