"use client";

import { useActionState } from "react";
import { createTenant, type CreateTenantState } from "./actions";

const initialState: CreateTenantState = {};

export default function CreateTenantForm() {
  const [state, formAction, pending] = useActionState(createTenant, initialState);

  return (
    <form action={formAction} className="card flex max-w-sm flex-col gap-4">
      <label>
        <span className="label">Nom de l&apos;établissement</span>
        <input name="nom" type="text" required className="input" />
      </label>
      <label>
        <span className="label">Slug</span>
        <input name="slug" type="text" required className="input" />
      </label>
      <label>
        <span className="label">Nom du premier admin</span>
        <input name="admin_nom" type="text" required className="input" />
      </label>
      <label>
        <span className="label">Email du premier admin</span>
        <input name="admin_email" type="email" required className="input" />
      </label>
      <label>
        <span className="label">Mot de passe</span>
        <input name="admin_password" type="password" required minLength={6} className="input" />
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-700">Établissement créé.</p>}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Création..." : "Créer l'établissement"}
      </button>
    </form>
  );
}
