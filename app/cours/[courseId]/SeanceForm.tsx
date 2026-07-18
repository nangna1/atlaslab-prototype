"use client";

import { useActionState } from "react";
import { createSeance, type CreateSeanceState } from "./actions";

const initialState: CreateSeanceState = {};

export default function SeanceForm({ courseId }: { courseId: string }) {
  const [state, formAction, pending] = useActionState(createSeance, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="course_id" value={courseId} />
      <input name="date_heure" type="datetime-local" required className="input w-auto flex-1" />
      <input
        name="lien_visio"
        type="text"
        placeholder="Lien visio externe (optionnel — sinon salle intégrée)"
        className="input w-auto flex-1"
      />
      <button type="submit" disabled={pending} className="btn-secondary">
        {pending ? "Ajout..." : "Programmer une séance"}
      </button>
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
    </form>
  );
}
