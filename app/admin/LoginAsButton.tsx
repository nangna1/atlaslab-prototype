"use client";

import { useState } from "react";
import { generateOwnReturnLink, generateLoginAsLink } from "./actions";
import { DEMO_RETURN_LINK_KEY } from "@/lib/demo-session";

export default function LoginAsButton({ targetUserId, targetNom }: { targetUserId: string; targetNom: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    const own = await generateOwnReturnLink();
    if (own.actionLink) {
      sessionStorage.setItem(DEMO_RETURN_LINK_KEY, own.actionLink);
    }

    const target = await generateLoginAsLink(targetUserId);
    if (target.error || !target.actionLink) {
      setError(target.error ?? "Erreur.");
      setLoading(false);
      return;
    }

    window.location.href = target.actionLink;
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={handleClick} disabled={loading} className="btn-link shrink-0 text-sm">
        {loading ? "Connexion..." : `Se connecter en tant que ${targetNom}`}
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </span>
  );
}
