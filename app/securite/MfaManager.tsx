"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type EnrollState = { factorId: string; qrCode: string; secret: string } | null;

export default function MfaManager() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [activeFactorId, setActiveFactorId] = useState<string | null>(null);
  const [enroll, setEnroll] = useState<EnrollState>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function refresh() {
    setLoading(true);
    const { data } = await supabase.auth.mfa.listFactors();
    setActiveFactorId(data?.totp?.[0]?.id ?? null);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startEnroll() {
    setError(null);
    setPending(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    setPending(false);
    if (error || !data) {
      setError(error?.message ?? "Impossible de démarrer l'activation.");
      return;
    }
    setEnroll({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
  }

  async function confirmEnroll() {
    if (!enroll) return;
    setError(null);
    setPending(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enroll.factorId,
      code: code.trim(),
    });
    setPending(false);
    if (error) {
      setError("Code invalide, réessayez.");
      return;
    }
    setEnroll(null);
    setCode("");
    await refresh();
  }

  async function cancelEnroll() {
    if (enroll) await supabase.auth.mfa.unenroll({ factorId: enroll.factorId });
    setEnroll(null);
    setCode("");
    setError(null);
  }

  async function disable() {
    if (!activeFactorId) return;
    if (!confirm("Désactiver la double authentification sur ce compte ?")) return;
    setPending(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: activeFactorId });
    setPending(false);
    if (error) {
      setError(error.message);
      return;
    }
    await refresh();
  }

  if (loading) return <p className="text-sm text-gray-500">Chargement...</p>;

  if (enroll) {
    return (
      <div className="card flex max-w-sm flex-col gap-4">
        <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
          Scannez ce QR code avec votre application d&apos;authentification (Google
          Authenticator, Authy…), puis saisissez le code à 6 chiffres généré.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={enroll.qrCode} alt="QR code d'activation 2FA" className="h-40 w-40 self-center" />
        <p className="text-center text-xs" style={{ fontFamily: "var(--font-mono)", color: "var(--ink-soft)" }}>
          Ou entrez ce code manuellement : {enroll.secret}
        </p>
        <input
          type="text"
          inputMode="numeric"
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="input text-center"
          maxLength={6}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={confirmEnroll} disabled={pending || code.length < 6} className="btn-primary">
            {pending ? "Vérification..." : "Confirmer"}
          </button>
          <button type="button" onClick={cancelEnroll} className="btn-secondary">
            Annuler
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card max-w-sm">
      {activeFactorId ? (
        <>
          <p className="mb-3 text-sm font-medium text-green-700">✓ Double authentification activée</p>
          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
          <button type="button" onClick={disable} disabled={pending} className="text-sm font-medium text-red-600 hover:underline">
            Désactiver
          </button>
        </>
      ) : (
        <>
          <p className="mb-3 text-sm" style={{ color: "var(--ink-soft)" }}>
            Non activée. Ajoutez une couche de sécurité supplémentaire à votre compte avec une
            application d&apos;authentification.
          </p>
          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
          <button type="button" onClick={startEnroll} disabled={pending} className="btn-primary">
            {pending ? "..." : "Activer la double authentification"}
          </button>
        </>
      )}
    </div>
  );
}
