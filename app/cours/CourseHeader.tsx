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
      <div>
        <h1 style={{ display: "inline" }}>{titre}</h1>{" "}
        <button type="button" onClick={() => setIsEditing(true)} style={{ fontSize: 14 }}>
          Modifier
        </button>
        <p style={{ color: "#666" }}>{filiere}</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 400, marginBottom: 12 }}>
      <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <input type="hidden" name="course_id" value={courseId} />
        <input name="titre" type="text" defaultValue={titre} required style={{ padding: 8 }} />
        <input name="filiere" type="text" defaultValue={filiere ?? ""} style={{ padding: 8 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" disabled={pending} style={{ padding: 8 }}>
            {pending ? "Enregistrement..." : "Enregistrer"}
          </button>
          <button type="button" onClick={() => setIsEditing(false)} style={{ padding: 8 }}>
            Annuler
          </button>
        </div>
        {state.error && <span style={{ color: "#c00" }}>{state.error}</span>}
      </form>
      <form
        action={(formData) => {
          if (confirm("Supprimer ce cours et tout son contenu ?")) {
            deleteCourse(formData);
          }
        }}
        style={{ marginTop: 8 }}
      >
        <input type="hidden" name="course_id" value={courseId} />
        <button type="submit" style={{ padding: 8, color: "#c00" }}>
          Supprimer le cours
        </button>
      </form>
    </div>
  );
}
