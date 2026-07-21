"use client";

import { useActionState } from "react";
import { createCreneau, type CreateCreneauState } from "./actions";

const initialState: CreateCreneauState = {};

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export default function CreneauForm({ courseId }: { courseId: string }) {
  const [state, formAction, pending] = useActionState(createCreneau, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="course_id" value={courseId} />
      <select name="jour" defaultValue="0" className="input w-auto">
        {JOURS.map((label, i) => (
          <option key={label} value={i}>
            {label}
          </option>
        ))}
      </select>
      <input name="heure_debut" type="time" required className="input w-auto" />
      <span className="text-sm text-gray-500">à</span>
      <input name="heure_fin" type="time" required className="input w-auto" />
      <input name="salle" type="text" placeholder="Salle (optionnel)" className="input w-auto flex-1" />
      <button type="submit" disabled={pending} className="btn-secondary">
        {pending ? "Ajout..." : "Ajouter un créneau"}
      </button>
      {state.error && <span className="w-full text-sm text-red-600">{state.error}</span>}
      {state.warning && <span className="w-full text-sm text-amber-600">⚠️ {state.warning}</span>}
      {state.success && !state.warning && <span className="w-full text-sm text-green-700">Créneau ajouté.</span>}
    </form>
  );
}
