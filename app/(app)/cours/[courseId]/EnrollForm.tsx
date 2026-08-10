"use client";

import { useActionState } from "react";
import { enrollStudent, type EnrollState } from "./actions";

const initialState: EnrollState = {};

type Candidat = { id: string; nom: string; email: string | null };

export default function EnrollForm({
  courseId,
  candidats,
}: {
  courseId: string;
  candidats: Candidat[];
}) {
  const [state, formAction, pending] = useActionState(enrollStudent, initialState);

  if (candidats.length === 0) {
    return <p className="text-sm text-gray-500">Tous les élèves du tenant sont déjà inscrits.</p>;
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="course_id" value={courseId} />
      <select name="user_id" required className="input w-auto flex-1">
        {candidats.map((candidat) => (
          <option key={candidat.id} value={candidat.id}>
            {candidat.nom}
            {candidat.email ? ` (${candidat.email})` : ""}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending} className="btn-secondary">
        {pending ? "Inscription..." : "Inscrire"}
      </button>
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      {state.success && <span className="text-sm text-green-700">Inscrit.</span>}
    </form>
  );
}
