"use client";

import { useActionState, useState } from "react";
import { upsertInsertionStaff, type InsertionStaffState } from "./actions";
import {
  INSERTION_STATUTS,
  INSERTION_STATUT_LABELS,
  NON_RENSEIGNE,
  NON_RENSEIGNE_LABEL,
  type InsertionStatut,
} from "@/lib/insertions";
import type { DiplomeInsertion } from "@/lib/insertions-data";

const initialState: InsertionStaffState = {};

export default function InsertionRow({ diplome }: { diplome: DiplomeInsertion }) {
  const [isEditing, setIsEditing] = useState(false);
  const [state, formAction, pending] = useActionState(upsertInsertionStaff, initialState);
  const [statut, setStatut] = useState<InsertionStatut>(
    diplome.statut === NON_RENSEIGNE ? "en_recherche" : diplome.statut,
  );
  const showEntreprise = statut === "emploi" || statut === "stage" || statut === "entrepreneuriat";

  if (isEditing) {
    return (
      <form
        action={formAction}
        className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3"
      >
        <input type="hidden" name="user_id" value={diplome.userId} />
        <input type="hidden" name="course_id" value={diplome.courseId} />
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-gray-900">{diplome.userNom}</span>
          <span className="text-sm text-gray-500">— {diplome.courseTitre}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            name="statut"
            value={statut}
            onChange={(e) => setStatut(e.target.value as InsertionStatut)}
            className="input w-auto"
          >
            {INSERTION_STATUTS.map((s) => (
              <option key={s} value={s}>
                {INSERTION_STATUT_LABELS[s]}
              </option>
            ))}
          </select>
          {showEntreprise && (
            <>
              <input
                name="entreprise"
                type="text"
                placeholder="Entreprise"
                defaultValue={diplome.entreprise ?? ""}
                className="input w-auto"
              />
              <input
                name="poste"
                type="text"
                placeholder="Poste"
                defaultValue={diplome.poste ?? ""}
                className="input w-auto"
              />
            </>
          )}
          <button type="submit" disabled={pending} className="btn-primary btn-sm">
            {pending ? "..." : "Enregistrer"}
          </button>
          <button type="button" onClick={() => setIsEditing(false)} className="btn-secondary btn-sm">
            Annuler
          </button>
        </div>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3">
      <div>
        <span className="text-gray-900">{diplome.userNom}</span>
        <span className="ml-2 text-sm text-gray-500">{diplome.courseTitre}</span>
      </div>
      <span className={diplome.statut === NON_RENSEIGNE ? "badge-muted" : "badge-success"}>
        {diplome.statut === NON_RENSEIGNE ? NON_RENSEIGNE_LABEL : INSERTION_STATUT_LABELS[diplome.statut]}
      </span>
      {diplome.entreprise && <span className="text-sm text-gray-500">{diplome.entreprise}</span>}
      <button type="button" onClick={() => setIsEditing(true)} className="btn-link shrink-0">
        Modifier
      </button>
    </div>
  );
}
