"use client";

import { useActionState, useState } from "react";
import {
  updateAccountNom,
  toggleAccountActive,
  type UpdateNomState,
  type ToggleActiveState,
} from "./actions";

const nomInitialState: UpdateNomState = {};
const toggleInitialState: ToggleActiveState = {};

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super admin",
  admin_tenant: "Admin établissement",
  professeur: "Professeur",
  apprenant: "Apprenant",
};

type Compte = {
  id: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  role: string;
  actif: boolean;
};

export default function AccountRow({ compte, isSelf }: { compte: Compte; isSelf: boolean }) {
  const [isEditing, setIsEditing] = useState(false);
  const [nomState, nomAction, nomPending] = useActionState(updateAccountNom, nomInitialState);
  const [toggleState, toggleAction] = useActionState(toggleAccountActive, toggleInitialState);
  const [handledSuccess, setHandledSuccess] = useState(nomState.success);

  if (nomState.success !== handledSuccess) {
    setHandledSuccess(nomState.success);
    if (nomState.success) setIsEditing(false);
  }

  if (isEditing) {
    return (
      <form action={nomAction} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-3">
        <input type="hidden" name="target_id" value={compte.id} />
        <input name="nom" type="text" defaultValue={compte.nom} required className="input flex-1" />
        <input
          name="telephone"
          type="tel"
          defaultValue={compte.telephone ?? ""}
          placeholder="Téléphone WhatsApp"
          className="input flex-1"
        />
        <button type="submit" disabled={nomPending} className="btn-primary btn-sm">
          {nomPending ? "Enregistrement..." : "Enregistrer"}
        </button>
        <button type="button" onClick={() => setIsEditing(false)} className="btn-secondary btn-sm">
          Annuler
        </button>
        {nomState.error && <span className="text-sm text-red-600">{nomState.error}</span>}
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3">
      <span className="text-gray-900">{compte.nom}</span>
      <span className="text-sm text-gray-500">{compte.email ?? "—"}</span>
      <span className="text-sm text-gray-500">
        {compte.telephone ? `📱 ${compte.telephone}` : "—"}
      </span>
      <span className="text-sm text-gray-500">{ROLE_LABEL[compte.role] ?? compte.role}</span>
      <span className={compte.actif ? "badge-success" : "badge-error"}>
        {compte.actif ? "Actif" : "Désactivé"}
      </span>
      <button type="button" onClick={() => setIsEditing(true)} className="btn-link shrink-0">
        Modifier
      </button>
      {!isSelf && (
        <form
          action={toggleAction}
          onSubmit={(e) => {
            if (compte.actif && !confirm(`Désactiver le compte de ${compte.nom} ?`)) e.preventDefault();
          }}
          className="shrink-0"
        >
          <input type="hidden" name="target_id" value={compte.id} />
          <input type="hidden" name="actif" value={String(compte.actif)} />
          <button
            type="submit"
            className={`text-sm font-medium hover:underline ${compte.actif ? "text-red-600" : "text-indigo-600"}`}
          >
            {compte.actif ? "Désactiver" : "Réactiver"}
          </button>
        </form>
      )}
      {toggleState.error && <span className="text-sm text-red-600">{toggleState.error}</span>}
    </div>
  );
}
