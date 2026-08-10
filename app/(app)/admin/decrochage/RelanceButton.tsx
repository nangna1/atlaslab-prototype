"use client";

import { useActionState } from "react";
import { relancerEleve, type RelanceState } from "./actions";

const initialState: RelanceState = {};

export default function RelanceButton({ userId }: { userId: string }) {
  const [state, formAction, pending] = useActionState(relancerEleve, initialState);

  return (
    <span className="flex items-center gap-2">
      <form action={formAction}>
        <input type="hidden" name="target_id" value={userId} />
        <button type="submit" disabled={pending || state.success} className="btn-secondary btn-sm">
          {state.success ? "Relancé ✓" : pending ? "Envoi..." : "Relancer"}
        </button>
      </form>
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
    </span>
  );
}
