"use client";

import { useActionState } from "react";
import { createCourse, type CreateCourseState } from "./actions";

const initialState: CreateCourseState = {};

export default function CreateCourseForm() {
  const [state, formAction, pending] = useActionState(createCourse, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input name="titre" type="text" placeholder="Titre du cours" required className="input w-auto flex-1" />
      <input name="filiere" type="text" placeholder="Filière (optionnel)" className="input w-auto flex-1" />
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Création..." : "Créer un cours"}
      </button>
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
    </form>
  );
}
