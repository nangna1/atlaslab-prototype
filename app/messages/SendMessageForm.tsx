"use client";

import { useActionState } from "react";
import { sendMessage, type SendMessageState } from "./actions";

const initialState: SendMessageState = {};

type Contact = { id: string; nom: string; role: string };

const ROLE_LABEL: Record<string, string> = {
  admin_tenant: "Admin établissement",
  professeur: "Professeur",
  apprenant: "Apprenant",
};

export default function SendMessageForm({
  recipientId,
  contacts,
}: {
  recipientId?: string;
  contacts?: Contact[];
}) {
  const [state, formAction, pending] = useActionState(sendMessage, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {recipientId ? (
        <input type="hidden" name="recipient_id" value={recipientId} />
      ) : (
        <label>
          <span className="label">Destinataire</span>
          <select name="recipient_id" required className="input" defaultValue="">
            <option value="" disabled>
              Choisir…
            </option>
            {(contacts ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom} — {ROLE_LABEL[c.role] ?? c.role}
              </option>
            ))}
          </select>
        </label>
      )}
      <textarea
        name="contenu"
        required
        rows={recipientId ? 2 : 3}
        placeholder="Votre message…"
        className="input"
      />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary self-start">
        {pending ? "Envoi..." : "Envoyer"}
      </button>
    </form>
  );
}
