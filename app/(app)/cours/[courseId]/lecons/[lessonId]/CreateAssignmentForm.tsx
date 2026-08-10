"use client";

import { useActionState } from "react";
import { createAssignment, type CreateAssignmentState } from "./actions";

const initialState: CreateAssignmentState = {};

export default function CreateAssignmentForm({
  courseId,
  lessonId,
}: {
  courseId: string;
  lessonId: string;
}) {
  const [state, formAction, pending] = useActionState(createAssignment, initialState);

  return (
    <form action={formAction} className="card flex max-w-sm flex-col gap-3">
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="lesson_id" value={lessonId} />
      <label>
        <span className="label">Titre du devoir</span>
        <input name="titre" type="text" required className="input" />
      </label>
      <label>
        <span className="label">Date limite (optionnel)</span>
        <input name="date_limite" type="datetime-local" className="input" />
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-secondary">
        {pending ? "Création..." : "Créer le devoir"}
      </button>
    </form>
  );
}
