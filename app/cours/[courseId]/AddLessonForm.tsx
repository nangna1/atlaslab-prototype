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
    <form action={formAction} className="card-dashed mt-3 flex flex-col gap-2">
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="module_id" value={moduleId} />
      <input name="titre" type="text" placeholder="Titre de la leçon" required className="input" />
      <select
        name="type"
        value={type}
        onChange={(e) => setType(e.target.value)}
        className="input"
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
        className="input"
      />
      <label>
        <span className="label">Document joint (PDF, Word, PPT — optionnel)</span>
        <input
          name="document"
          type="file"
          accept=".pdf,.doc,.docx,.ppt,.pptx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          className="input"
        />
      </label>
      {type === "labo" && (
        <>
          <select
            name="labo_type"
            value={laboType}
            onChange={(e) => setLaboType(e.target.value)}
            className="input"
          >
            <option value="eecircuit">Électronique (EEcircuit)</option>
            <option value="circuitverse">Logique numérique (CircuitVerse)</option>
          </select>
          {laboType === "eecircuit" ? (
            <textarea name="netlist" placeholder="Netlist SPICE" rows={4} className="input font-mono" />
          ) : (
            <input
              name="embed_url"
              type="text"
              placeholder="URL d'embed CircuitVerse"
              className="input"
            />
          )}
        </>
      )}
      {type === "quiz" && <QuizQuestionsEditor initialQuestions={[]} />}
      <button type="submit" disabled={pending} className="btn-secondary">
        {pending ? "Ajout..." : "Ajouter une leçon"}
      </button>
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
    </form>
  );
}
