"use client";

import { useActionState, useEffect } from "react";
import { initierPaiementEnLigne, type InitierPaiementState } from "./actions";

const initialState: InitierPaiementState = {};

export default function PaierEnLigneButton({ fraisId }: { fraisId: string }) {
  const [state, formAction, pending] = useActionState(initierPaiementEnLigne, initialState);

  useEffect(() => {
    if (state.paymentUrl) window.location.href = state.paymentUrl;
  }, [state.paymentUrl]);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="frais_id" value={fraisId} />
      <button type="submit" disabled={pending} className="btn-primary text-sm">
        {pending ? "Redirection..." : "Payer maintenant"}
      </button>
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
