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

type Compte = { id: string; nom: string; email: string | null; role: string; actif: boolean };

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
      <form
        action={nomAction}
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          padding: 12,
          border: "1px solid #eee",
          borderRadius: 6,
        }}
      >
        <input type="hidden" name="target_id" value={compte.id} />
        <input name="nom" type="text" defaultValue={compte.nom} required style={{ padding: 6, flex: 1 }} />
        <button type="submit" disabled={nomPending} style={{ padding: 6 }}>
          {nomPending ? "Enregistrement..." : "Enregistrer"}
        </button>
        <button type="button" onClick={() => setIsEditing(false)} style={{ padding: 6 }}>
          Annuler
        </button>
        {nomState.error && <span style={{ color: "#c00" }}>{nomState.error}</span>}
      </form>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 12,
        border: "1px solid #eee",
        borderRadius: 6,
      }}
    >
      <span>{compte.nom}</span>
      <span style={{ color: "#666" }}>{compte.email ?? "—"}</span>
      <span style={{ color: "#666" }}>{ROLE_LABEL[compte.role] ?? compte.role}</span>
      <span style={{ color: compte.actif ? "#080" : "#c00" }}>
        {compte.actif ? "Actif" : "Désactivé"}
      </span>
      <button type="button" onClick={() => setIsEditing(true)} style={{ fontSize: 13 }}>
        Modifier
      </button>
      {!isSelf && (
        <form
          action={(formData) => {
            if (!compte.actif || confirm(`Désactiver le compte de ${compte.nom} ?`)) {
              toggleAction(formData);
            }
          }}
        >
          <input type="hidden" name="target_id" value={compte.id} />
          <input type="hidden" name="actif" value={String(compte.actif)} />
          <button type="submit" style={{ fontSize: 13, color: compte.actif ? "#c00" : undefined }}>
            {compte.actif ? "Désactiver" : "Réactiver"}
          </button>
        </form>
      )}
      {toggleState.error && <span style={{ color: "#c00" }}>{toggleState.error}</span>}
    </div>
  );
}
