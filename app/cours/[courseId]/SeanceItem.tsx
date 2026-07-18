"use client";

import { useState } from "react";
import { deleteSeance } from "./actions";
import AttendanceForm from "./AttendanceForm";

type Seance = { id: string; date_heure: string; lien_visio: string | null };

const STATUT_BADGE: Record<string, { label: string; className: string }> = {
  present: { label: "Présent", className: "badge-success" },
  absent: { label: "Absent", className: "badge-error" },
  retard: { label: "Retard", className: "badge-muted" },
};

export default function SeanceItem({
  courseId,
  seance,
  isStaff,
  monStatut,
  eleves,
  attendanceParEleve,
}: {
  courseId: string;
  seance: Seance;
  isStaff: boolean;
  monStatut?: string;
  eleves?: { user_id: string; nom: string }[];
  attendanceParEleve?: Record<string, string>;
}) {
  const [showAttendance, setShowAttendance] = useState(false);
  const dateLabel = new Date(seance.date_heure).toLocaleString("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const badge = monStatut ? STATUT_BADGE[monStatut] : null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-gray-900">{dateLabel}</span>
        {badge && <span className={badge.className}>{badge.label}</span>}
        {seance.lien_visio ? (
          <a href={seance.lien_visio} target="_blank" rel="noreferrer" className="btn-link">
            Rejoindre
          </a>
        ) : (
          <span className="text-sm text-gray-500">—</span>
        )}
        {isStaff && (
          <button
            type="button"
            onClick={() => setShowAttendance((v) => !v)}
            className="btn-link text-sm"
          >
            Faire l&apos;appel
          </button>
        )}
        {isStaff && (
          <form
            action={deleteSeance}
            onSubmit={(e) => {
              if (!confirm("Supprimer cette séance ?")) e.preventDefault();
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
      {isStaff && showAttendance && (
        <AttendanceForm
          courseId={courseId}
          seanceId={seance.id}
          eleves={eleves ?? []}
          initialStatuts={attendanceParEleve ?? {}}
        />
      )}
    </div>
  );
}
