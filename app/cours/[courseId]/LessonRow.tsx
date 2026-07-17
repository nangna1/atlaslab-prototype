"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { updateLesson, deleteLesson, type UpdateLessonState } from "./actions";

const initialState: UpdateLessonState = {};

const TYPE_LABEL: Record<string, string> = {
  contenu: "📄 Contenu",
  labo: "🔬 Laboratoire",
  quiz: "✅ Quiz",
  seance_directe: "🎥 Séance en direct",
};

type Lesson = {
  id: string;
  titre: string;
  type: string;
  contenu_markdown: string | null;
  labo_type: string | null;
  labo_config: { netlist?: string; embed_url?: string } | null;
};

export default function LessonRow({ courseId, lesson }: { courseId: string; lesson: Lesson }) {
  const [isEditing, setIsEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateLesson, initialState);
  const [type, setType] = useState(lesson.type);
  const [laboType, setLaboType] = useState(lesson.labo_type ?? "eecircuit");
  const [handledSuccess, setHandledSuccess] = useState(state.success);

  if (state.success !== handledSuccess) {
    setHandledSuccess(state.success);
    if (state.success) setIsEditing(false);
  }

  if (!isEditing) {
    return (
      <li style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Link
            href={`/cours/${courseId}/lecons/${lesson.id}`}
            style={{
              display: "block",
              flex: 1,
              padding: 12,
              border: "1px solid #eee",
              borderRadius: 6,
              textDecoration: "none",
              color: "inherit",
            }}
          >
            {TYPE_LABEL[lesson.type]} — {lesson.titre}
          </Link>
          <button type="button" onClick={() => setIsEditing(true)} style={{ fontSize: 13 }}>
            Modifier
          </button>
          <form
            action={(formData) => {
              if (confirm("Supprimer cette leçon ?")) {
                deleteLesson(formData);
              }
            }}
          >
            <input type="hidden" name="course_id" value={courseId} />
            <input type="hidden" name="lesson_id" value={lesson.id} />
            <button type="submit" style={{ fontSize: 13, color: "#c00" }}>
              Supprimer
            </button>
          </form>
        </div>
      </li>
    );
  }

  return (
    <li style={{ marginBottom: 8 }}>
      <form
        action={formAction}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: 12,
          border: "1px dashed #ccc",
          borderRadius: 6,
        }}
      >
        <input type="hidden" name="course_id" value={courseId} />
        <input type="hidden" name="lesson_id" value={lesson.id} />
        <input name="titre" type="text" defaultValue={lesson.titre} required style={{ padding: 8 }} />
        <select name="type" value={type} onChange={(e) => setType(e.target.value)} style={{ padding: 8 }}>
          <option value="contenu">Contenu</option>
          <option value="labo">Laboratoire</option>
          <option value="quiz">Quiz</option>
          <option value="seance_directe">Séance en direct</option>
        </select>
        <textarea
          name="contenu_markdown"
          defaultValue={lesson.contenu_markdown ?? ""}
          placeholder="Contenu (markdown, optionnel)"
          rows={3}
          style={{ padding: 8 }}
        />
        {type === "labo" && (
          <>
            <select
              name="labo_type"
              value={laboType}
              onChange={(e) => setLaboType(e.target.value)}
              style={{ padding: 8 }}
            >
              <option value="eecircuit">Électronique (EEcircuit)</option>
              <option value="circuitverse">Logique numérique (CircuitVerse)</option>
            </select>
            {laboType === "eecircuit" ? (
              <textarea
                name="netlist"
                defaultValue={lesson.labo_config?.netlist ?? ""}
                placeholder="Netlist SPICE"
                rows={4}
                style={{ padding: 8 }}
              />
            ) : (
              <input
                name="embed_url"
                type="text"
                defaultValue={lesson.labo_config?.embed_url ?? ""}
                placeholder="URL d'embed CircuitVerse"
                style={{ padding: 8 }}
              />
            )}
          </>
        )}
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
    </li>
  );
}
