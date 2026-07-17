"use client";

import { useActionState } from "react";
import { createCourse, type CreateCourseState } from "./actions";

const initialState: CreateCourseState = {};

export default function CreateCourseForm() {
  const [state, formAction, pending] = useActionState(createCourse, initialState);

  return (
    <form
      action={formAction}
      style={{ display: "flex", gap: 8, marginBottom: 24, alignItems: "center", flexWrap: "wrap" }}
    >
      <input name="titre" type="text" placeholder="Titre du cours" required style={{ padding: 8 }} />
      <input name="filiere" type="text" placeholder="Filière (optionnel)" style={{ padding: 8 }} />
      <button type="submit" disabled={pending} style={{ padding: 8 }}>
        {pending ? "Création..." : "Créer un cours"}
      </button>
      {state.error && <span style={{ color: "#c00" }}>{state.error}</span>}
    </form>
  );
}
