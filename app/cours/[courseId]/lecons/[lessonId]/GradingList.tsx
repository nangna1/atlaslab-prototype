"use client";

import { useActionState } from "react";
import { gradeSubmission, type GradeSubmissionState } from "./actions";

const initialState: GradeSubmissionState = {};

type Submission = {
  id: string;
  user_id: string;
  nom: string;
  contenu: string | null;
  fichier_url: string | null;
  note: number | null;
  submitted_at: string;
};

function GradingRow({
  courseId,
  lessonId,
  submission,
}: {
  courseId: string;
  lessonId: string;
  submission: Submission;
}) {
  const [state, formAction, pending] = useActionState(gradeSubmission, initialState);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <span className="font-medium text-gray-900">{submission.nom}</span>
        <span className="text-xs text-gray-500">
          {new Date(submission.submitted_at).toLocaleString("fr-FR", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Africa/Abidjan",
          })}
        </span>
      </div>
      {submission.contenu && (
        <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{submission.contenu}</p>
      )}
      {submission.fichier_url && (
        <a href={submission.fichier_url} target="_blank" rel="noreferrer" className="btn-link text-sm">
          Fichier rendu
        </a>
      )}
      {submission.note !== null ? (
        <p className="mt-2 font-medium text-green-700">Note : {submission.note}/20</p>
      ) : (
        <form action={formAction} className="mt-2 flex items-center gap-2">
          <input type="hidden" name="course_id" value={courseId} />
          <input type="hidden" name="lesson_id" value={lessonId} />
          <input type="hidden" name="submission_id" value={submission.id} />
          <input
            name="note"
            type="number"
            min={0}
            max={20}
            step="0.5"
            placeholder="/20"
            required
            className="input w-24"
          />
          <button type="submit" disabled={pending} className="btn-secondary btn-sm">
            {pending ? "..." : "Noter"}
          </button>
          {state.error && <span className="text-sm text-red-600">{state.error}</span>}
        </form>
      )}
    </div>
  );
}

export default function GradingList({
  courseId,
  lessonId,
  submissions,
}: {
  courseId: string;
  lessonId: string;
  submissions: Submission[];
}) {
  if (submissions.length === 0) {
    return <p className="text-sm text-gray-500">Aucun rendu pour le moment.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {submissions.map((submission) => (
        <GradingRow key={submission.id} courseId={courseId} lessonId={lessonId} submission={submission} />
      ))}
    </div>
  );
}
