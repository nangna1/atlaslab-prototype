"use client";

import { useActionState } from "react";
import { createSeance, type CreateSeanceState } from "./actions";

const initialState: CreateSeanceState = {};

export default function SeanceForm({ courseId }: { courseId: string }) {
  const [state, formAction, pending] = useActionState(createSeance, initialState);

  return (
    <form
      action={formAction}
      style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}
    >
      <input type="hidden" name="course_id" value={courseId} />
      <input name="date_heure" type="datetime-local" required style={{ padding: 8 }} />
      <input name="lien_visio" type="text" placeholder="Lien visio (optionnel)" style={{ padding: 8 }} />
      <button type="submit" disabled={pending} style={{ padding: 8 }}>
        {pending ? "Ajout..." : "Programmer une séance"}
      </button>
      {state.error && <span style={{ color: "#c00" }}>{state.error}</span>}
    </form>
  );
}
