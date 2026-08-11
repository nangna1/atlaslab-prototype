"use client";

import { useActionState } from "react";
import { approveTenant, rejectTenant, type TenantApprovalState } from "./actions";

const initialState: TenantApprovalState = {};

export default function TenantApprovalActions({ tenantId, tenantNom }: { tenantId: string; tenantNom: string }) {
  const [approveState, approveAction, approvePending] = useActionState(approveTenant, initialState);
  const [rejectState, rejectAction, rejectPending] = useActionState(rejectTenant, initialState);

  return (
    <div className="flex items-center gap-2">
      <form action={approveAction}>
        <input type="hidden" name="tenant_id" value={tenantId} />
        <button type="submit" disabled={approvePending || rejectPending} className="btn-primary btn-sm">
          {approvePending ? "Approbation..." : "Approuver"}
        </button>
      </form>
      <form
        action={rejectAction}
        onSubmit={(e) => {
          if (!confirm(`Refuser la demande de ${tenantNom} ?`)) e.preventDefault();
        }}
      >
        <input type="hidden" name="tenant_id" value={tenantId} />
        <button type="submit" disabled={approvePending || rejectPending} className="text-sm font-medium text-red-600 hover:underline">
          {rejectPending ? "Refus..." : "Refuser"}
        </button>
      </form>
      {(approveState.error || rejectState.error) && (
        <span className="text-sm text-red-600">{approveState.error || rejectState.error}</span>
      )}
    </div>
  );
}
