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
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 12,
        border: "1px solid #eee",
        borderRadius: 6,
      }}
    >
      <span>{dateLabel}</span>
      {seance.lien_visio ? (
        <a href={seance.lien_visio} target="_blank" rel="noreferrer">
          Rejoindre
        </a>
      ) : (
        <span style={{ color: "#666" }}>—</span>
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
          <button type="submit" style={{ fontSize: 13, color: "#c00" }}>
            Supprimer
          </button>
        </form>
      )}
    </div>
  );
}
