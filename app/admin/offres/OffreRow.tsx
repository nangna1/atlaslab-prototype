"use client";

import { useActionState } from "react";
import { toggleOffreStatut, deleteOffre, type ToggleOffreState } from "./actions";

const initialState: ToggleOffreState = {};

type Offre = {
  id: string;
  titre: string;
  entreprise: string;
  type: string;
  filiere: string | null;
  localisation: string | null;
  statut: string;
};

export default function OffreRow({ offre }: { offre: Offre }) {
  const [toggleState, toggleAction] = useActionState(toggleOffreStatut, initialState);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3">
      <div>
        <span className="font-medium text-gray-900">{offre.titre}</span>
        <span className="ml-2 text-sm text-gray-500">
          {offre.entreprise} — {offre.type === "stage" ? "Stage" : "Emploi"}
          {offre.localisation ? ` — ${offre.localisation}` : ""}
        </span>
      </div>
      <span className={offre.statut === "ouverte" ? "badge-success" : "badge-muted"}>
        {offre.statut === "ouverte" ? "Ouverte" : "Fermée"}
      </span>
      <div className="flex items-center gap-2">
        <form action={toggleAction}>
          <input type="hidden" name="target_id" value={offre.id} />
          <input type="hidden" name="statut" value={offre.statut} />
          <button type="submit" className="btn-link text-sm">
            {offre.statut === "ouverte" ? "Fermer" : "Rouvrir"}
          </button>
        </form>
        <form
          action={deleteOffre}
          onSubmit={(e) => {
            if (!confirm(`Supprimer l'offre "${offre.titre}" ?`)) e.preventDefault();
          }}
        >
          <input type="hidden" name="target_id" value={offre.id} />
          <button type="submit" className="text-sm font-medium text-red-600 hover:underline">
            Supprimer
          </button>
        </form>
      </div>
      {toggleState.error && <span className="text-sm text-red-600">{toggleState.error}</span>}
    </div>
  );
}
