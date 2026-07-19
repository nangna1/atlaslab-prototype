import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import LanguageSwitcher from "./LanguageSwitcher";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/cours");

  const locale = await getLocale();
  const dict = getDictionary(locale);

  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-atlaslab.png" alt="AtlasLab" className="h-10 w-auto" />
        <div className="flex items-center gap-5">
          <LanguageSwitcher />
          <Link href="/login" className="btn-link">
            {dict.landing.cta}
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <p
          className="mb-4 text-xs font-semibold tracking-[0.12em] uppercase"
          style={{ fontFamily: "var(--font-mono)", color: "var(--brand)" }}
        >
          {dict.landing.eyebrow}
        </p>
        <h1 className="text-3xl font-bold sm:text-4xl" style={{ color: "var(--ink)" }}>
          {dict.landing.title}
        </h1>
        <p className="mt-4 text-lg" style={{ color: "var(--ink-soft)" }}>
          {dict.landing.subtitle}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link href="/login" className="btn-primary inline-flex">
            {dict.landing.cta}
          </Link>
          <Link href="/inscription-etablissement" className="btn-link">
            {dict.landing.signupCta}
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl grid-cols-1 gap-4 px-6 pb-20 sm:grid-cols-2">
        {dict.landing.features.map((feature) => (
          <div key={feature.title} className="card">
            <h2 className="font-semibold" style={{ color: "var(--ink)" }}>
              {feature.title}
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>
              {feature.description}
            </p>
          </div>
        ))}
      </section>

      <footer
        className="mx-auto max-w-5xl px-6 pb-10 text-center text-sm"
        style={{ color: "var(--ink-soft)", fontFamily: "var(--font-mono)" }}
      >
        © {new Date().getFullYear()} {dict.landing.footer}
      </footer>
    </main>
  );
}
