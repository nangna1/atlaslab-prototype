"use client";

import { useActionState } from "react";
import { creerLien, type CreerLienState } from "./actions";

const initialState: CreerLienState = {};

type Compte = { id: string; nom: string };

export default function CreateLienForm({ parents, enfants }: { parents: Compte[]; enfants: Compte[] }) {
  const [state, formAction, pending] = useActionState(creerLien, initialState);

  if (parents.length === 0 || enfants.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Il faut au moins un compte <strong>Parent</strong> et un compte <strong>Apprenant</strong> pour créer un
        lien (voir <strong>Comptes</strong>).
      </p>
    );
  }

  return (
    <form action={formAction} className="card flex max-w-lg flex-col gap-4">
      <label>
        <span className="label">Parent</span>
        <select name="parent_id" required className="input">
          {parents.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nom}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="label">Élève</span>
        <select name="enfant_id" required className="input">
          {enfants.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nom}
            </option>
          ))}
        </select>
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-700">Lien créé.</p>}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Création..." : "Créer le lien"}
      </button>
    </form>
  );
}
