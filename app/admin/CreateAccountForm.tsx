"use client";

import { useActionState } from "react";
import { createAccount, type ActionState } from "./actions";

const initialState: ActionState = {};

export default function CreateAccountForm() {
  const [state, formAction, pending] = useActionState(createAccount, initialState);

  return (
    <form action={formAction} className="card flex max-w-sm flex-col gap-4">
      <label>
        <span className="label">Nom</span>
        <input name="nom" type="text" required className="input" />
      </label>
      <label>
        <span className="label">Email</span>
        <input name="email" type="email" required className="input" />
      </label>
      <label>
        <span className="label">Téléphone (WhatsApp, optionnel)</span>
        <input name="telephone" type="tel" placeholder="+225 07 00 00 00 00" className="input" />
      </label>
      <label>
        <span className="label">Mot de passe</span>
        <input name="password" type="password" required minLength={6} className="input" />
      </label>
      <label>
        <span className="label">Rôle</span>
        <select name="role" defaultValue="apprenant" className="input">
          <option value="professeur">Professeur</option>
          <option value="apprenant">Apprenant</option>
        </select>
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-700">Compte créé.</p>}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Création..." : "Créer le compte"}
      </button>
    </form>
  );
}
