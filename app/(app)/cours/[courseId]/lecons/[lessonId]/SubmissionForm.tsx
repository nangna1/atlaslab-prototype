"use client";

import { useActionState } from "react";
import { submitAssignment, type SubmitAssignmentState } from "./actions";

const initialState: SubmitAssignmentState = {};

type Submission = { contenu: string | null; fichier_url: string | null; note: number | null };

export default function SubmissionForm({
  courseId,
  lessonId,
  assignmentId,
  submission,
}: {
  courseId: string;
  lessonId: string;
  assignmentId: string;
  submission: Submission | null;
}) {
  const [state, formAction, pending] = useActionState(submitAssignment, initialState);

  if (submission && submission.note !== null) {
    return (
      <div className="card">
        <p className="mb-2 text-sm text-gray-500">Votre rendu (noté)</p>
        {submission.contenu && <p className="mb-2 whitespace-pre-wrap text-gray-700">{submission.contenu}</p>}
        {submission.fichier_url && (
          <a href={submission.fichier_url} target="_blank" rel="noreferrer" className="btn-link">
            Fichier rendu
          </a>
        )}
        <p className="mt-3 font-medium text-green-700">Note : {submission.note}/20</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="card flex flex-col gap-3">
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="lesson_id" value={lessonId} />
      <input type="hidden" name="assignment_id" value={assignmentId} />
      <label>
        <span className="label">Votre réponse</span>
        <textarea name="contenu" rows={4} defaultValue={submission?.contenu ?? ""} className="input" />
      </label>
      <label>
        <span className="label">Lien de fichier (optionnel)</span>
        <input
          name="fichier_url"
          type="text"
          defaultValue={submission?.fichier_url ?? ""}
          placeholder="https://..."
          className="input"
        />
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-700">Rendu enregistré.</p>}
      <button type="submit" disabled={pending} className="btn-primary self-start">
        {pending ? "Envoi..." : submission ? "Mettre à jour mon rendu" : "Rendre le devoir"}
      </button>
    </form>
  );
}
