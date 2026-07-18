"use client";

import { useActionState } from "react";
import { markAttendance, type MarkAttendanceState } from "./actions";

const initialState: MarkAttendanceState = {};

export default function AttendanceForm({
  courseId,
  seanceId,
  eleves,
  initialStatuts,
}: {
  courseId: string;
  seanceId: string;
  eleves: { user_id: string; nom: string }[];
  initialStatuts: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(markAttendance, initialState);

  return (
    <form action={formAction} className="mt-2 flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3">
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="seance_id" value={seanceId} />
      {eleves.length === 0 ? (
        <p className="text-sm text-gray-500">Aucun élève inscrit.</p>
      ) : (
        eleves.map((eleve) => (
          <div key={eleve.user_id} className="flex items-center justify-between gap-2">
            <span className="text-sm text-gray-900">{eleve.nom}</span>
            <select
              name={`statut_${eleve.user_id}`}
              defaultValue={initialStatuts[eleve.user_id] ?? ""}
              className="input w-auto"
            >
              <option value="">—</option>
              <option value="present">Présent</option>
              <option value="absent">Absent</option>
              <option value="retard">Retard</option>
            </select>
          </div>
        ))
      )}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-700">Présences enregistrées.</p>}
      {eleves.length > 0 && (
        <button type="submit" disabled={pending} className="btn-secondary btn-sm self-start">
          {pending ? "Enregistrement..." : "Enregistrer les présences"}
        </button>
      )}
    </form>
  );
}
