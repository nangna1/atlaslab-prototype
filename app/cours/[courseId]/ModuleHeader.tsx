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
      <h2 style={{ fontSize: 18, borderBottom: "1px solid #ddd", paddingBottom: 8 }}>
        {titre}{" "}
        <button type="button" onClick={() => setIsEditing(true)} style={{ fontSize: 13 }}>
          Modifier
        </button>{" "}
        <form
          action={(formData) => {
            if (confirm("Supprimer ce module et ses leçons ?")) {
              deleteModule(formData);
            }
          }}
          style={{ display: "inline" }}
        >
          <input type="hidden" name="course_id" value={courseId} />
          <input type="hidden" name="module_id" value={moduleId} />
          <button type="submit" style={{ fontSize: 13, color: "#c00" }}>
            Supprimer
          </button>
        </form>
      </h2>
    );
  }

  return (
    <form
      action={formAction}
      style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}
    >
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="module_id" value={moduleId} />
      <input name="titre" type="text" defaultValue={titre} required style={{ padding: 6 }} />
      <button type="submit" disabled={pending} style={{ padding: 6 }}>
        {pending ? "Enregistrement..." : "Enregistrer"}
      </button>
      <button type="button" onClick={() => setIsEditing(false)} style={{ padding: 6 }}>
        Annuler
      </button>
      {state.error && <span style={{ color: "#c00" }}>{state.error}</span>}
    </form>
  );
}
