"use client";

import { deleteSeance } from "./actions";

type Seance = { id: string; date_heure: string; lien_visio: string | null };

export default function SeanceItem({
  courseId,
  seance,
  isStaff,
}: {
  courseId: string;
  seance: Seance;
  isStaff: boolean;
}) {
  const dateLabel = new Date(seance.date_heure).toLocaleString("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3">
      <span className="text-gray-900">{dateLabel}</span>
      {seance.lien_visio ? (
        <a href={seance.lien_visio} target="_blank" rel="noreferrer" className="btn-link">
          Rejoindre
        </a>
      ) : (
        <span className="text-sm text-gray-500">—</span>
      )}
      {isStaff && (
        <form
          action={(formData) => {
            if (confirm("Supprimer cette séance ?")) {
              deleteSeance(formData);
            }
          }}
        >
          <input type="hidden" name="course_id" value={courseId} />
          <input type="hidden" name="seance_id" value={seance.id} />
          <button type="submit" className="text-sm font-medium text-red-600 hover:underline">
            Supprimer
          </button>
        </form>
      )}
    </div>
  );
}
