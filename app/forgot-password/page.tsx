"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/use-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default function ForgotPasswordPage() {
  const locale = useLocale();
  const dict = getDictionary(locale);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    setLoading(false);
    // Message générique dans tous les cas (pas d'énumération de comptes) —
    // une vraie erreur réseau/rate-limit reste affichée telle quelle.
    if (error && error.status && error.status >= 500) {
      setError(dict.forgotPassword.genericError);
      return;
    }
    setSent(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-atlaslab.png" alt="AtlasLab" className="mx-auto mb-2 h-20 w-auto" />
        <p className="mb-6 text-center text-sm text-gray-500">{dict.forgotPassword.subtitle}</p>

        {sent ? (
          <div className="card">
            <p className="text-sm text-gray-700">{dict.forgotPassword.sentMessage}</p>
            <Link href="/login" className="btn-link mt-3 inline-block text-sm">
              {dict.forgotPassword.backToLogin}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card flex flex-col gap-4">
            <label>
              <span className="label">{dict.forgotPassword.email}</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
              />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? dict.forgotPassword.submitting : dict.forgotPassword.submit}
            </button>
            <Link href="/login" className="btn-link text-center text-sm">
              {dict.forgotPassword.backToLogin}
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
