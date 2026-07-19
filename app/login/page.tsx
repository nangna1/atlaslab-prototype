"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/use-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default function LoginPage() {
  const router = useRouter();
  const locale = useLocale();
  const dict = getDictionary(locale);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/cours");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-atlaslab.png" alt="AtlasLab" className="mx-auto mb-2 h-20 w-auto" />
        <p className="mb-6 text-center text-sm text-gray-500">{dict.login.subtitle}</p>
        <form onSubmit={handleSubmit} className="card flex flex-col gap-4">
          <label>
            <span className="label">{dict.login.email}</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
            />
          </label>
          <label>
            <span className="label">{dict.login.password}</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? dict.login.submitting : dict.login.submit}
          </button>
          <Link href="/forgot-password" className="btn-link text-center text-sm">
            {dict.login.forgotPassword}
          </Link>
          <Link href="/inscription-etablissement" className="btn-link text-center text-sm">
            {dict.login.signupTenant}
          </Link>
        </form>
      </div>
    </main>
  );
}
