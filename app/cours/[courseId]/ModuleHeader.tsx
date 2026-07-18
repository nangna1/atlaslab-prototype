"use client";

import { useActionState, useState } from "react";
import { updateModule, deleteModule, type UpdateModuleState } from "./actions";

const initialState: UpdateModuleState = {};

export default function ModuleHeader({
  courseId,
  moduleId,
  titre,
}: {
  courseId: string;
  moduleId: string;
  titre: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateModule, initialState);
  const [handledSuccess, setHandledSuccess] = useState(state.success);

  if (state.success !== handledSuccess) {
    setHandledSuccess(state.success);
    if (state.success) setIsEditing(false);
  }

  if (!isEditing) {
    return (
      <div className="mb-3 flex items-center justify-between border-b border-gray-200 pb-2">
        <h2 className="text-lg font-semibold text-gray-900">{titre}</h2>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setIsEditing(true)} className="btn-link">
            Modifier
          </button>
          <form
            action={(formData) => {
              if (confirm("Supprimer ce module et ses leçons ?")) {
                deleteModule(formData);
              }
            }}
          >
            <input type="hidden" name="course_id" value={courseId} />
            <input type="hidden" name="module_id" value={moduleId} />
            <button type="submit" className="text-sm font-medium text-red-600 hover:underline">
              Supprimer
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="mb-3 flex items-center gap-2">
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="module_id" value={moduleId} />
      <input name="titre" type="text" defaultValue={titre} required className="input w-auto flex-1" />
      <button type="submit" disabled={pending} className="btn-primary btn-sm">
        {pending ? "Enregistrement..." : "Enregistrer"}
      </button>
      <button type="button" onClick={() => setIsEditing(false)} className="btn-secondary btn-sm">
        Annuler
      </button>
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
    </form>
  );
}
