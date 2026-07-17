"use client";

import { useState, useEffect } from "react";
import { Simulation } from "eecircuit-engine";

const NETLIST = `Circuit RC simple - test AtlasLab
v1 in 0 pulse(0 5 0 1m 1m 10m 20m)
r1 in out 1k
c1 out 0 1u
.tran 0.1m 20m
.end`;

export default function LaboTestEEcircuit() {
  const [status, setStatus] = useState<string>("Non lancé");
  const [result, setResult] = useState<string>("");

  async function runTest() {
    setStatus("Chargement du moteur ngspice-WASM...");
    try {
      const sim = new Simulation();
      await sim.start();
      setStatus("Moteur chargé. Exécution du netlist...");
      sim.setNetList(NETLIST);
      const res = await sim.runSim();
      setStatus("Simulation terminée avec succès.");
      setResult(JSON.stringify(res, null, 2).slice(0, 2000));
    } catch (err) {
      setStatus("Erreur : " + String(err));
    }
  }

  useEffect(() => {
    runTest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main style={{ padding: 24, fontFamily: "monospace" }}>
      <h1>Test d&apos;intégration — eecircuit-engine (ngspice-WASM, MIT)</h1>
      <p>
        Validation de la section 1.2 bis / 4.2 de l&apos;architecture technique AtlasLab :
        simulation SPICE réelle (circuit RC) exécutée 100% côté navigateur, sans serveur.
      </p>
      <button onClick={runTest} style={{ padding: "8px 16px", fontSize: 16 }}>
        Lancer la simulation RC
      </button>
      <p><b>Statut :</b> {status}</p>
      {result && (
        <pre style={{ background: "#111", color: "#0f0", padding: 12, overflow: "auto" }}>
          {result}
        </pre>
      )}
    </main>
  );
}
