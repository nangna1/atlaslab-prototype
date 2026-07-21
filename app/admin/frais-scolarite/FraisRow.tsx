"use client";

import { useActionState } from "react";
import { deleteFrais, type DeleteFraisState } from "./actions";
import { formatMontantCFA } from "@/lib/format";

const initialState: DeleteFraisState = {};

type Frais = {
  id: string;
  libelle: string;
  filiere: string | null;
  montant: number;
  echeance: string | null;
};

export default function FraisRow({ frais }: { frais: Frais }) {
  const [state, formAction] = useActionState(deleteFrais, initialState);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3">
      <div>
        <span className="font-medium text-gray-900">{frais.libelle}</span>
        <span className="ml-2 text-sm text-gray-500">
          {formatMontantCFA(frais.montant)}
          {frais.filiere ? ` — ${frais.filiere}` : " — toutes filières"}
          {frais.echeance ? ` — échéance ${new Date(frais.echeance).toLocaleDateString("fr-FR")}` : ""}
        </span>
      </div>
      <form
        action={formAction}
        onSubmit={(e) => {
          if (!confirm(`Supprimer le frais "${frais.libelle}" ? (impossible si des paiements y sont déjà rattachés)`)) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="target_id" value={frais.id} />
        <button type="submit" className="text-sm font-medium text-red-600 hover:underline">
          Supprimer
        </button>
      </form>
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
    </div>
  );
}
