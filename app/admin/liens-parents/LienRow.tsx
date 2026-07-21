"use client";

import { useActionState } from "react";
import { supprimerLien, type SupprimerLienState } from "./actions";

const initialState: SupprimerLienState = {};

export default function LienRow({
  lien,
}: {
  lien: { id: string; parentNom: string; enfantNom: string };
}) {
  const [state, formAction] = useActionState(supprimerLien, initialState);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3">
      <span className="text-sm text-gray-700">
        <span className="font-medium text-gray-900">{lien.parentNom}</span> — parent de{" "}
        <span className="font-medium text-gray-900">{lien.enfantNom}</span>
      </span>
      <form
        action={formAction}
        onSubmit={(e) => {
          if (!confirm(`Supprimer le lien entre "${lien.parentNom}" et "${lien.enfantNom}" ?`)) e.preventDefault();
        }}
      >
        <input type="hidden" name="target_id" value={lien.id} />
        <button type="submit" className="text-sm font-medium text-red-600 hover:underline">
          Supprimer
        </button>
      </form>
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
    </div>
  );
}
