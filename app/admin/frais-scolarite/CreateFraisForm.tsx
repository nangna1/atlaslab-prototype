"use client";

import { useActionState } from "react";
import { createFrais, type CreateFraisState } from "./actions";

const initialState: CreateFraisState = {};

export default function CreateFraisForm() {
  const [state, formAction, pending] = useActionState(createFrais, initialState);

  return (
    <form action={formAction} className="card flex max-w-lg flex-col gap-4">
      <label>
        <span className="label">Libellé</span>
        <input name="libelle" type="text" required placeholder="ex. Scolarité trimestre 1" className="input" />
      </label>
      <label>
        <span className="label">Montant (FCFA)</span>
        <input name="montant" type="number" min="1" step="1" required className="input" />
      </label>
      <label>
        <span className="label">Filière concernée (optionnel — laisser vide pour tout le monde)</span>
        <input name="filiere" type="text" placeholder="ex. Électronique" className="input" />
      </label>
      <label>
        <span className="label">Échéance (optionnel)</span>
        <input name="echeance" type="date" className="input" />
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-700">Frais créé.</p>}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Création..." : "Créer le frais"}
      </button>
    </form>
  );
}
