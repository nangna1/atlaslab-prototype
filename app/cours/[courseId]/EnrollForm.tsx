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
    return <p style={{ color: "#666", marginTop: 12 }}>Tous les élèves du tenant sont déjà inscrits.</p>;
  }

  return (
    <form
      action={formAction}
      style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}
    >
      <input type="hidden" name="course_id" value={courseId} />
      <select name="user_id" required style={{ padding: 8 }}>
        {candidats.map((candidat) => (
          <option key={candidat.id} value={candidat.id}>
            {candidat.nom}
            {candidat.email ? ` (${candidat.email})` : ""}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending} style={{ padding: 8 }}>
        {pending ? "Inscription..." : "Inscrire"}
      </button>
      {state.error && <span style={{ color: "#c00" }}>{state.error}</span>}
      {state.success && <span style={{ color: "#080" }}>Inscrit.</span>}
    </form>
  );
}
