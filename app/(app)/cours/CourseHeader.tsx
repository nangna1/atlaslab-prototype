"use client";

import { useActionState, useState } from "react";
import { updateCourse, deleteCourse, type UpdateCourseState } from "./actions";

const initialState: UpdateCourseState = {};

export default function CourseHeader({
  courseId,
  titre,
  filiere,
}: {
  courseId: string;
  titre: string;
  filiere: string | null;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateCourse, initialState);
  const [handledSuccess, setHandledSuccess] = useState(state.success);

  if (state.success !== handledSuccess) {
    setHandledSuccess(state.success);
    if (state.success) setIsEditing(false);
  }

  if (!isEditing) {
    return (
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-gray-900">{titre}</h1>
          <button type="button" onClick={() => setIsEditing(true)} className="btn-link">
            Modifier
          </button>
        </div>
        <p className="mt-1 text-sm text-gray-500">{filiere}</p>
      </div>
    );
  }

  return (
    <div className="mb-6 max-w-sm">
      <form action={formAction} className="flex flex-col gap-2">
        <input type="hidden" name="course_id" value={courseId} />
        <input name="titre" type="text" defaultValue={titre} required className="input" />
        <input name="filiere" type="text" defaultValue={filiere ?? ""} className="input" />
        <div className="flex gap-2">
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? "Enregistrement..." : "Enregistrer"}
          </button>
          <button type="button" onClick={() => setIsEditing(false)} className="btn-secondary">
            Annuler
          </button>
        </div>
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </form>
      <form
        action={deleteCourse}
        onSubmit={(e) => {
          if (!confirm("Supprimer ce cours et tout son contenu ?")) e.preventDefault();
        }}
        className="mt-2"
      >
        <input type="hidden" name="course_id" value={courseId} />
        <button type="submit" className="btn-danger btn-sm">
          Supprimer le cours
        </button>
      </form>
    </div>
  );
}
