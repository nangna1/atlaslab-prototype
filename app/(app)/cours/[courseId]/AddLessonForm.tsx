"use client";

import { useActionState, useState } from "react";
import { createLesson, type CreateLessonState } from "./actions";
import QuizQuestionsEditor from "./QuizQuestionsEditor";
import { MAX_FILE_SIZE_MB, MAX_FILE_SIZE_BYTES, formatFileSize } from "@/lib/document-limits";

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
  // Empeche l'envoi d'un fichier au-dela du plafond de body des Server
  // Actions Next.js avant meme qu'il ne parte : au-dela, la requete est
  // rejetee par le framework et produit un crash generique cote client
  // plutot qu'une erreur propre (voir lib/document-limits.ts).
  const [sizeError, setSizeError] = useState<string | null>(null);

  function handleDocumentChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setSizeError(null);
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setSizeError(`Document trop volumineux (${formatFileSize(file.size)}) — ${MAX_FILE_SIZE_MB} Mo maximum.`);
      e.target.value = "";
    } else {
      setSizeError(null);
    }
  }

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
        <span className="label">Document joint (PDF, Word, PPT — optionnel, {MAX_FILE_SIZE_MB} Mo maximum)</span>
        <input
          name="document"
          type="file"
          accept=".pdf,.doc,.docx,.ppt,.pptx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          onChange={handleDocumentChange}
          className="input"
        />
        {sizeError && <span className="text-sm text-red-600">{sizeError}</span>}
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
      <button type="submit" disabled={pending || !!sizeError} className="btn-secondary">
        {pending ? "Ajout..." : "Ajouter une leçon"}
      </button>
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
    </form>
  );
}
