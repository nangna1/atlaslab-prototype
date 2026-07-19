"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signupTenant, type SignupTenantState } from "./actions";
import { useLocale } from "@/lib/i18n/use-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";

const initialState: SignupTenantState = {};

export default function SignupTenantPage() {
  const locale = useLocale();
  const dict = getDictionary(locale);
  const [state, formAction, pending] = useActionState(signupTenant, initialState);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-atlaslab.png" alt="AtlasLab" className="mx-auto mb-2 h-20 w-auto" />
        <p
          className="mb-1 text-center text-xs font-semibold tracking-[0.12em] uppercase"
          style={{ fontFamily: "var(--font-mono)", color: "var(--brand)" }}
        >
          {dict.signupTenant.eyebrow}
        </p>
        <h1 className="mb-1 text-center text-lg font-semibold" style={{ color: "var(--ink)" }}>
          {dict.signupTenant.title}
        </h1>
        <p className="mb-6 text-center text-sm" style={{ color: "var(--ink-soft)" }}>
          {dict.signupTenant.subtitle}
        </p>

        {state.success ? (
          <div className="card text-center">
            <p className="text-2xl">✅</p>
            <p className="mt-2 text-sm" style={{ color: "var(--ink)" }}>
              {dict.signupTenant.sentMessage}
            </p>
            <Link href="/" className="btn-link mt-3 inline-block text-sm">
              ← Retour à l&apos;accueil
            </Link>
          </div>
        ) : (
          <form action={formAction} className="card flex flex-col gap-4">
            <label>
              <span className="label">{dict.signupTenant.nomEtablissement}</span>
              <input name="nom" type="text" required className="input" />
            </label>
            <label>
              <span className="label">{dict.signupTenant.slug}</span>
              <input name="slug" type="text" placeholder="mon-etablissement" className="input" />
              <span className="mt-1 block text-xs" style={{ color: "var(--ink-soft)" }}>
                {dict.signupTenant.slugHint}
              </span>
            </label>
            <label>
              <span className="label">{dict.signupTenant.adminNom}</span>
              <input name="admin_nom" type="text" required className="input" />
            </label>
            <label>
              <span className="label">{dict.signupTenant.adminEmail}</span>
              <input name="admin_email" type="email" required className="input" />
            </label>
            <label>
              <span className="label">{dict.signupTenant.adminPassword}</span>
              <input name="admin_password" type="password" required minLength={6} className="input" />
            </label>
            {state.error && <p className="text-sm text-red-600">{state.error}</p>}
            <button type="submit" disabled={pending} className="btn-primary w-full">
              {pending ? dict.signupTenant.submitting : dict.signupTenant.submit}
            </button>
            <Link href="/login" className="btn-link text-center text-sm">
              {dict.signupTenant.backToLogin}
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
