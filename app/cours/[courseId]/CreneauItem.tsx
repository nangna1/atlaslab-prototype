"use client";

import { deleteCreneau } from "./actions";

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

type Creneau = {
  id: string;
  jour: number;
  heure_debut: string;
  heure_fin: string;
  salle: string | null;
};

export default function CreneauItem({
  courseId,
  creneau,
  isStaff,
}: {
  courseId: string;
  creneau: Creneau;
  isStaff: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3">
      <span className="text-sm text-gray-700">
        <span className="font-medium text-gray-900">{JOURS[creneau.jour] ?? creneau.jour}</span>{" "}
        {creneau.heure_debut.slice(0, 5)}–{creneau.heure_fin.slice(0, 5)}
        {creneau.salle ? ` — ${creneau.salle}` : ""}
      </span>
      {isStaff && (
        <form
          action={deleteCreneau}
          onSubmit={(e) => {
            if (!confirm("Supprimer ce créneau ?")) e.preventDefault();
          }}
        >
          <input type="hidden" name="course_id" value={courseId} />
          <input type="hidden" name="creneau_id" value={creneau.id} />
          <button type="submit" className="text-sm font-medium text-red-600 hover:underline">
            Supprimer
          </button>
        </form>
      )}
    </div>
  );
}
