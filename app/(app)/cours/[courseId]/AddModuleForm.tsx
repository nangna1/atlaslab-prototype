"use client";

import { useActionState } from "react";
import { createModule, type CreateModuleState } from "./actions";

const initialState: CreateModuleState = {};

export default function AddModuleForm({ courseId }: { courseId: string }) {
  const [state, formAction, pending] = useActionState(createModule, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="course_id" value={courseId} />
      <input name="titre" type="text" placeholder="Titre du module" required className="input w-auto flex-1" />
      <button type="submit" disabled={pending} className="btn-secondary">
        {pending ? "Ajout..." : "Ajouter un module"}
      </button>
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
    </form>
  );
}
