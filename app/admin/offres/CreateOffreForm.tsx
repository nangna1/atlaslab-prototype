"use client";

import { useActionState } from "react";
import { createOffre, type CreateOffreState } from "./actions";

const initialState: CreateOffreState = {};

export default function CreateOffreForm() {
  const [state, formAction, pending] = useActionState(createOffre, initialState);

  return (
    <form action={formAction} className="card flex max-w-lg flex-col gap-4">
      <label>
        <span className="label">Titre du poste</span>
        <input name="titre" type="text" required className="input" />
      </label>
      <label>
        <span className="label">Entreprise</span>
        <input name="entreprise" type="text" required className="input" />
      </label>
      <label>
        <span className="label">Type</span>
        <select name="type" defaultValue="stage" className="input">
          <option value="stage">Stage</option>
          <option value="emploi">Emploi</option>
        </select>
      </label>
      <label>
        <span className="label">Filière concernée (optionnel)</span>
        <input name="filiere" type="text" placeholder="ex. Électronique" className="input" />
      </label>
      <label>
        <span className="label">Localisation</span>
        <input name="localisation" type="text" placeholder="ex. Abidjan" className="input" />
      </label>
      <label>
        <span className="label">Description</span>
        <textarea name="description" rows={3} className="input" />
      </label>
      <label>
        <span className="label">Contact (email ou téléphone)</span>
        <input name="contact" type="text" className="input" />
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-700">Offre publiée.</p>}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Publication..." : "Publier l'offre"}
      </button>
    </form>
  );
}
