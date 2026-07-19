"use client";

import { useActionState } from "react";
import { importAccounts, type ImportAccountsState } from "./actions";

const initialState: ImportAccountsState = {};

export default function ImportAccountsForm() {
  const [state, formAction, pending] = useActionState(importAccounts, initialState);

  return (
    <div className="card-dashed flex max-w-2xl flex-col gap-4">
      <div>
        <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
          Importer une classe (CSV)
        </p>
        <p
          className="mt-1 text-xs"
          style={{ color: "var(--ink-soft)", fontFamily: "var(--font-mono)" }}
        >
          Colonnes : nom, email, role (professeur/apprenant — apprenant par défaut),
          mot_de_passe (optionnel, généré sinon), telephone (optionnel, active les alertes
          WhatsApp)
        </p>
      </div>

      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <input
          name="fichier"
          type="file"
          accept=".csv,text/csv"
          required
          className="input w-auto flex-1"
        />
        <button type="submit" disabled={pending} className="btn-secondary shrink-0">
          {pending ? "Import..." : "Importer le fichier"}
        </button>
      </form>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      {state.results && state.results.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ color: "var(--ink-soft)" }}>
                <th className="pr-4 pb-2 font-medium">Nom</th>
                <th className="pr-4 pb-2 font-medium">Email</th>
                <th className="pr-4 pb-2 font-medium">Rôle</th>
                <th className="pr-4 pb-2 font-medium">Mot de passe</th>
                <th className="pb-2 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {state.results.map((r) => (
                <tr key={r.email} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <td className="py-1.5 pr-4">{r.nom}</td>
                  <td className="py-1.5 pr-4">{r.email}</td>
                  <td className="py-1.5 pr-4">{r.role}</td>
                  <td className="py-1.5 pr-4" style={{ fontFamily: "var(--font-mono)" }}>
                    {r.password ?? "—"}
                  </td>
                  <td className="py-1.5">
                    {r.error ? (
                      <span className="badge-error">{r.error}</span>
                    ) : (
                      <span className="badge-success">Créé</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs" style={{ color: "var(--ink-soft)" }}>
            Notez ces mots de passe maintenant, ils ne seront plus affichés ensuite. Chaque
            compte pourra le changer via « Mot de passe oublié » à la connexion.
          </p>
        </div>
      )}
    </div>
  );
}
