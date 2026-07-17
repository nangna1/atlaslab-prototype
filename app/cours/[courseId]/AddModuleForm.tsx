"use client";

import { useActionState } from "react";
import { createModule, type CreateModuleState } from "./actions";

const initialState: CreateModuleState = {};

export default function AddModuleForm({ courseId }: { courseId: string }) {
  const [state, formAction, pending] = useActionState(createModule, initialState);

  return (
    <form
      action={formAction}
      style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "center", flexWrap: "wrap" }}
    >
      <input type="hidden" name="course_id" value={courseId} />
      <input name="titre" type="text" placeholder="Titre du module" required style={{ padding: 8 }} />
      <button type="submit" disabled={pending} style={{ padding: 8 }}>
        {pending ? "Ajout..." : "Ajouter un module"}
      </button>
      {state.error && <span style={{ color: "#c00" }}>{state.error}</span>}
    </form>
  );
}
