"use client";

import { useActionState } from "react";
import { updateOwnProfile, type UpdateProfileState } from "./actions";

const initialState: UpdateProfileState = {};

export default function ProfileForm({
  nom,
  telephone,
  email,
}: {
  nom: string;
  telephone: string | null;
  email: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateOwnProfile, initialState);

  return (
    <form action={formAction} className="card flex max-w-sm flex-col gap-4">
      <label>
        <span className="label">Email</span>
        <input type="email" value={email ?? ""} disabled className="input opacity-60" />
      </label>
      <label>
        <span className="label">Nom</span>
        <input name="nom" type="text" defaultValue={nom} required className="input" />
      </label>
      <label>
        <span className="label">Téléphone (WhatsApp)</span>
        <input
          name="telephone"
          type="tel"
          defaultValue={telephone ?? ""}
          placeholder="+225 07 00 00 00 00"
          className="input"
        />
        <span className="mt-1 block text-xs" style={{ color: "var(--ink-soft)" }}>
          Nécessaire pour recevoir les notifications WhatsApp (devoirs notés, séances, messages…).
        </span>
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-700">Profil mis à jour.</p>}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Enregistrement..." : "Enregistrer"}
      </button>
    </form>
  );
}
