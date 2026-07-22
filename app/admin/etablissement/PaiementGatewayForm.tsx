"use client";

import { useActionState } from "react";
import { enregistrerConfigCinetPay, type EnregistrerConfigCinetPayState } from "./actions";

const initialState: EnregistrerConfigCinetPayState = {};

export default function PaiementGatewayForm({ configured }: { configured: boolean }) {
  const [state, formAction, pending] = useActionState(enregistrerConfigCinetPay, initialState);

  return (
    <section className="card flex max-w-sm flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Paiement en ligne (CinetPay)</h2>
        <p className="mt-1 text-sm text-gray-500">
          {configured
            ? "✅ Configuré — les élèves peuvent payer leurs frais en ligne directement sur votre compte marchand."
            : "Non configuré — associez votre propre compte marchand CinetPay pour permettre le paiement en ligne des frais de scolarité."}
        </p>
      </div>
      <form action={formAction} className="flex flex-col gap-4">
        <label>
          <span className="label">Clé API (apikey)</span>
          <input name="api_key" type="password" required className="input" autoComplete="off" />
        </label>
        <label>
          <span className="label">Site ID</span>
          <input name="site_id" type="text" required className="input" autoComplete="off" />
        </label>
        <label>
          <span className="label">Clé secrète</span>
          <input name="secret_key" type="password" required className="input" autoComplete="off" />
        </label>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.success && <p className="text-sm text-green-700">Identifiants enregistrés.</p>}
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Enregistrement..." : configured ? "Mettre à jour" : "Enregistrer"}
        </button>
      </form>
    </section>
  );
}
