"use client";

import { useActionState, useState } from "react";
import {
  updateAccountNom,
  toggleAccountActive,
  setModerateur,
  type UpdateNomState,
  type ToggleActiveState,
  type SetModerateurState,
} from "./actions";
import LoginAsButton from "./LoginAsButton";

const nomInitialState: UpdateNomState = {};
const toggleInitialState: ToggleActiveState = {};
const moderateurInitialState: SetModerateurState = {};

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
  est_moderateur?: boolean;
};

export default function AccountRow({
  compte,
  isSelf,
  isFullAdmin,
}: {
  compte: Compte;
  isSelf: boolean;
  isFullAdmin: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [nomState, nomAction, nomPending] = useActionState(updateAccountNom, nomInitialState);
  const [toggleState, toggleAction] = useActionState(toggleAccountActive, toggleInitialState);
  const [moderateurState, moderateurAction] = useActionState(setModerateur, moderateurInitialState);
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
      {isFullAdmin && compte.role === "professeur" && (
        <form action={moderateurAction} className="shrink-0">
          <input type="hidden" name="target_id" value={compte.id} />
          <input type="hidden" name="value" value={String(!compte.est_moderateur)} />
          <button type="submit" className="btn-link text-sm">
            {compte.est_moderateur ? "Retirer modérateur" : "Rendre modérateur"}
          </button>
        </form>
      )}
      {compte.role === "professeur" && compte.est_moderateur && (
        <span className="badge-muted">Modérateur</span>
      )}
      <button type="button" onClick={() => setIsEditing(true)} className="btn-link shrink-0">
        Modifier
      </button>
      {isFullAdmin && !isSelf && compte.role !== "super_admin" && compte.actif && (
        <LoginAsButton targetUserId={compte.id} targetNom={compte.nom} />
      )}
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
      {moderateurState.error && <span className="text-sm text-red-600">{moderateurState.error}</span>}
    </div>
  );
}
