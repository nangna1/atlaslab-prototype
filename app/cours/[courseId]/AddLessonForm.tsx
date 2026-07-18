"use client";

import { useActionState, useState } from "react";
import { createLesson, type CreateLessonState } from "./actions";
import QuizQuestionsEditor from "./QuizQuestionsEditor";

const initialState: CreateLessonState = {};

export default function AddLessonForm({
  courseId,
  moduleId,
}: {
  courseId: string;
  moduleId: string;
}) {
  const [state, formAction, pending] = useActionState(createLesson, initialState);
  const [type, setType] = useState("contenu");
  const [laboType, setLaboType] = useState("eecircuit");

  return (
    <form
      action={formAction}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        marginTop: 12,
        padding: 12,
        border: "1px dashed #ccc",
        borderRadius: 6,
      }}
    >
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="module_id" value={moduleId} />
      <input name="titre" type="text" placeholder="Titre de la leçon" required style={{ padding: 8 }} />
      <select
        name="type"
        value={type}
        onChange={(e) => setType(e.target.value)}
        style={{ padding: 8 }}
      >
        <option value="contenu">Contenu</option>
        <option value="labo">Laboratoire</option>
        <option value="quiz">Quiz</option>
        <option value="seance_directe">Séance en direct</option>
      </select>
      <textarea
        name="contenu_markdown"
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
            <textarea name="netlist" placeholder="Netlist SPICE" rows={4} style={{ padding: 8 }} />
          ) : (
            <input
              name="embed_url"
              type="text"
              placeholder="URL d'embed CircuitVerse"
              style={{ padding: 8 }}
            />
          )}
        </>
      )}
      {type === "quiz" && <QuizQuestionsEditor initialQuestions={[]} />}
      <button type="submit" disabled={pending} style={{ padding: 8 }}>
        {pending ? "Ajout..." : "Ajouter une leçon"}
      </button>
      {state.error && <span style={{ color: "#c00" }}>{state.error}</span>}
    </form>
  );
}
