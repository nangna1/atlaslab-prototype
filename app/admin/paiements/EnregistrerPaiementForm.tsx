"use client";

import { useActionState } from "react";
import { enregistrerPaiement, type EnregistrerPaiementState } from "./actions";
import { formatMontantCFA } from "@/lib/format";

const initialState: EnregistrerPaiementState = {};

type FraisOption = { id: string; libelle: string; reste: number };

export default function EnregistrerPaiementForm({
  eleveId,
  fraisOptions,
}: {
  eleveId: string;
  fraisOptions: FraisOption[];
}) {
  const [state, formAction, pending] = useActionState(enregistrerPaiement, initialState);

  if (fraisOptions.length === 0) {
    return <p className="text-sm text-gray-500">Aucun frais restant à régler pour cet élève.</p>;
  }

  return (
    <form action={formAction} className="card flex max-w-lg flex-col gap-4">
      <input type="hidden" name="eleve_id" value={eleveId} />
      <label>
        <span className="label">Frais</span>
        <select name="frais_id" required className="input">
          {fraisOptions.map((f) => (
            <option key={f.id} value={f.id}>
              {f.libelle} — reste {formatMontantCFA(f.reste)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="label">Montant payé (FCFA)</span>
        <input name="montant" type="number" min="1" step="1" required className="input" />
      </label>
      <label>
        <span className="label">Moyen de paiement</span>
        <select name="moyen_paiement" defaultValue="especes" className="input">
          <option value="especes">Espèces</option>
          <option value="virement">Virement</option>
          <option value="mobile_money">Mobile money</option>
          <option value="cheque">Chèque</option>
          <option value="autre">Autre</option>
        </select>
      </label>
      <label>
        <span className="label">Référence (optionnel)</span>
        <input name="reference" type="text" placeholder="ex. n° de reçu" className="input" />
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-700">Paiement enregistré.</p>}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Enregistrement..." : "Enregistrer le paiement"}
      </button>
    </form>
  );
}
