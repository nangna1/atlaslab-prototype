"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { updateLesson, deleteLesson, type UpdateLessonState } from "./actions";
import QuizQuestionsEditor from "./QuizQuestionsEditor";

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
  quiz_questions: { question: string; options: string[]; correct: number }[] | null;
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
      <li>
        <div className="flex items-center gap-2">
          <Link href={`/cours/${courseId}/lecons/${lesson.id}`} className="card-link flex-1">
            {TYPE_LABEL[lesson.type]} — {lesson.titre}
          </Link>
          <button type="button" onClick={() => setIsEditing(true)} className="btn-link shrink-0">
            Modifier
          </button>
          <form
            action={deleteLesson}
            onSubmit={(e) => {
              if (!confirm("Supprimer cette leçon ?")) e.preventDefault();
            }}
            className="shrink-0"
          >
            <input type="hidden" name="course_id" value={courseId} />
            <input type="hidden" name="lesson_id" value={lesson.id} />
            <button type="submit" className="text-sm font-medium text-red-600 hover:underline">
              Supprimer
            </button>
          </form>
        </div>
      </li>
    );
  }

  return (
    <li>
      <form action={formAction} className="card-dashed flex flex-col gap-2">
        <input type="hidden" name="course_id" value={courseId} />
        <input type="hidden" name="lesson_id" value={lesson.id} />
        <input name="titre" type="text" defaultValue={lesson.titre} required className="input" />
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
          defaultValue={lesson.contenu_markdown ?? ""}
          placeholder="Contenu (markdown, optionnel)"
          rows={3}
          className="input"
        />
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
              <textarea
                name="netlist"
                defaultValue={lesson.labo_config?.netlist ?? ""}
                placeholder="Netlist SPICE"
                rows={4}
                className="input font-mono"
              />
            ) : (
              <input
                name="embed_url"
                type="text"
                defaultValue={lesson.labo_config?.embed_url ?? ""}
                placeholder="URL d'embed CircuitVerse"
                className="input"
              />
            )}
          </>
        )}
        {type === "quiz" && <QuizQuestionsEditor initialQuestions={lesson.quiz_questions ?? []} />}
        <div className="flex gap-2">
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? "Enregistrement..." : "Enregistrer"}
          </button>
          <button type="button" onClick={() => setIsEditing(false)} className="btn-secondary">
            Annuler
          </button>
        </div>
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </form>
    </li>
  );
}
