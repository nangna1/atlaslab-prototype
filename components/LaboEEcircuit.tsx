"use client";

import { useState } from "react";
import { Simulation, type ResultType } from "eecircuit-engine";
import SpiceResultChart from "./SpiceResultChart";

// Composant labo réutilisable, validé le 17/07/2026 (voir
// app/labo-test-eecircuit/page.tsx pour le test d'intégration d'origine).
export default function LaboEEcircuit({ netlist }: { netlist: string }) {
  const [status, setStatus] = useState("Prêt.");
  const [result, setResult] = useState<ResultType | null>(null);

  async function runTest() {
    setStatus("Chargement du moteur de simulation...");
    setResult(null);
    try {
      const sim = new Simulation();
      await sim.start();
      sim.setNetList(netlist);
      const res = await sim.runSim();
      setStatus(`Simulation terminée — ${res.dataType}, ${res.numPoints} points calculés.`);
      setResult(res);
    } catch (err) {
      setStatus("Erreur : " + String(err));
    }
  }

  return (
    <div className="card">
      <p className="mb-2 text-xs text-gray-500">
        Laboratoire de simulation électronique (ngspice-WASM, 100% navigateur)
      </p>
      <pre className="overflow-auto rounded-md bg-gray-50 p-3 font-mono text-xs text-gray-700">
        {netlist}
      </pre>
      <button onClick={runTest} className="btn-primary mt-3">
        Lancer la simulation
      </button>
      <p className="mt-2 text-sm text-gray-700">
        <b>Statut :</b> {status} {result && "✅"}
      </p>
      {result && <SpiceResultChart result={result} />}
    </div>
  );
}
