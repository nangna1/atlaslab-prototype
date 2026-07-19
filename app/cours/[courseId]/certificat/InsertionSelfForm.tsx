"use client";

import { useActionState, useState } from "react";
import { upsertInsertionSelf, type InsertionSelfState } from "./actions";
import { INSERTION_STATUTS, INSERTION_STATUT_LABELS, type InsertionStatut } from "@/lib/insertions";

const initialState: InsertionSelfState = {};

export default function InsertionSelfForm({
  courseId,
  current,
}: {
  courseId: string;
  current: { statut: InsertionStatut; entreprise: string | null; poste: string | null } | null;
}) {
  const [state, formAction, pending] = useActionState(upsertInsertionSelf, initialState);
  const [statut, setStatut] = useState<InsertionStatut>(current?.statut ?? "en_recherche");
  const showEntreprise = statut === "emploi" || statut === "stage" || statut === "entrepreneuriat";

  return (
    <div className="card mt-6 max-w-sm print:hidden">
      <h2 className="mb-1 font-semibold" style={{ color: "var(--ink)" }}>
        Et maintenant ?
      </h2>
      <p className="mb-3 text-sm" style={{ color: "var(--ink-soft)" }}>
        Dites-nous où vous en êtes après cette formation — ça nous aide à faire progresser
        AtlasLab.
      </p>
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="course_id" value={courseId} />
        <label>
          <span className="label">Votre situation</span>
          <select
            name="statut"
            value={statut}
            onChange={(e) => setStatut(e.target.value as InsertionStatut)}
            className="input"
          >
            {INSERTION_STATUTS.map((s) => (
              <option key={s} value={s}>
                {INSERTION_STATUT_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        {showEntreprise && (
          <>
            <label>
              <span className="label">Entreprise</span>
              <input name="entreprise" type="text" defaultValue={current?.entreprise ?? ""} className="input" />
            </label>
            <label>
              <span className="label">Poste</span>
              <input name="poste" type="text" defaultValue={current?.poste ?? ""} className="input" />
            </label>
          </>
        )}
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.success && <p className="text-sm text-green-700">Merci, c&apos;est enregistré.</p>}
        <button type="submit" disabled={pending} className="btn-secondary">
          {pending ? "Enregistrement..." : "Enregistrer"}
        </button>
      </form>
    </div>
  );
}
