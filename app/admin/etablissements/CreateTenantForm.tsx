"use client";

import { useActionState } from "react";
import { createTenant, type CreateTenantState } from "./actions";

const initialState: CreateTenantState = {};

export default function CreateTenantForm() {
  const [state, formAction, pending] = useActionState(createTenant, initialState);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 400 }}>
      <label>
        Nom de l&apos;établissement
        <input
          name="nom"
          type="text"
          required
          style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
        />
      </label>
      <label>
        Slug
        <input
          name="slug"
          type="text"
          required
          style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
        />
      </label>
      <label>
        Nom du premier admin
        <input
          name="admin_nom"
          type="text"
          required
          style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
        />
      </label>
      <label>
        Email du premier admin
        <input
          name="admin_email"
          type="email"
          required
          style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
        />
      </label>
      <label>
        Mot de passe
        <input
          name="admin_password"
          type="password"
          required
          minLength={6}
          style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
        />
      </label>
      {state.error && <p style={{ color: "#c00" }}>{state.error}</p>}
      {state.success && <p style={{ color: "#080" }}>Établissement créé.</p>}
      <button type="submit" disabled={pending} style={{ padding: 10 }}>
        {pending ? "Création..." : "Créer l'établissement"}
      </button>
    </form>
  );
}
