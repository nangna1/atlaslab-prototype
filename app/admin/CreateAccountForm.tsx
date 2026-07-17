"use client";

import { useActionState } from "react";
import { createAccount, type ActionState } from "./actions";

const initialState: ActionState = {};

export default function CreateAccountForm() {
  const [state, formAction, pending] = useActionState(createAccount, initialState);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 400 }}>
      <label>
        Nom
        <input
          name="nom"
          type="text"
          required
          style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
        />
      </label>
      <label>
        Email
        <input
          name="email"
          type="email"
          required
          style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
        />
      </label>
      <label>
        Mot de passe
        <input
          name="password"
          type="password"
          required
          minLength={6}
          style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
        />
      </label>
      <label>
        Rôle
        <select
          name="role"
          defaultValue="apprenant"
          style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
        >
          <option value="professeur">Professeur</option>
          <option value="apprenant">Apprenant</option>
        </select>
      </label>
      {state.error && <p style={{ color: "#c00" }}>{state.error}</p>}
      {state.success && <p style={{ color: "#080" }}>Compte créé.</p>}
      <button type="submit" disabled={pending} style={{ padding: 10 }}>
        {pending ? "Création..." : "Créer le compte"}
      </button>
    </form>
  );
}
