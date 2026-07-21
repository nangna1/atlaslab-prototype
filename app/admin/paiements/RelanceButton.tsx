"use client";

import { useActionState } from "react";
import { relancerPaiement, type RelancePaiementState } from "./actions";

const initialState: RelancePaiementState = {};

export default function RelanceButton({ userId, solde }: { userId: string; solde: number }) {
  const [state, formAction, pending] = useActionState(relancerPaiement, initialState);

  return (
    <span className="flex items-center gap-2">
      <form action={formAction}>
        <input type="hidden" name="target_id" value={userId} />
        <input type="hidden" name="solde" value={solde} />
        <button type="submit" disabled={pending || state.success} className="btn-secondary btn-sm">
          {state.success ? "Relancé ✓" : pending ? "Envoi..." : "Relancer"}
        </button>
      </form>
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
    </span>
  );
}
