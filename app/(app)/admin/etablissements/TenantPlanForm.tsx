"use client";

import { useActionState } from "react";
import { changerPlan, type ChangerPlanState } from "./actions";

const initialState: ChangerPlanState = {};

export default function TenantPlanForm({ tenantId, plan }: { tenantId: string; plan: string }) {
  const [state, formAction, pending] = useActionState(changerPlan, initialState);
  const autrePlan = plan === "essai" ? "standard" : "essai";

  return (
    <span className="flex items-center gap-2">
      <form action={formAction}>
        <input type="hidden" name="tenant_id" value={tenantId} />
        <input type="hidden" name="plan" value={autrePlan} />
        <button type="submit" disabled={pending} className="btn-link text-sm">
          {pending ? "..." : autrePlan === "standard" ? "Passer en standard" : "Repasser en essai"}
        </button>
      </form>
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
    </span>
  );
}
