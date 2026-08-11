"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/use-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import LanguageSwitcher from "@/app/LanguageSwitcher";

// Destination par role apres connexion (2026-08-11, demande utilisateur :
// "un tableau de bord adapte a chaque utilisateur"). admin_tenant/
// super_admin ont deja de vrais tableaux de bord ailleurs dans l'app
// (statistiques d'etablissement, gestion multi-etablissements) - /cours
// (liste de cours generique) n'est pas leur "chez eux" naturel, contrairement
// a apprenant/professeur qui y ont chacun un tableau de bord dedie. Un
// admin_tenant/super_admin garde neanmoins un acces complet a /cours via la
// sidebar (voir AppSidebar.tsx) - seule la destination par defaut change ici,
// aucune fonctionnalite n'est retiree.
async function landingRouteForRole(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<string> {
  const { data: profile } = await supabase.from("users").select("role").eq("id", userId).single();
  switch (profile?.role) {
    case "admin_tenant":
      return "/admin/tableau-de-bord";
    case "super_admin":
      return "/admin/etablissements";
    case "parent":
      return "/portail-parent";
    default:
      return "/cours";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const locale = useLocale();
  const dict = getDictionary(locale);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsTotp, setNeedsTotp] = useState(false);
  const [totpCode, setTotpCode] = useState("");

  useEffect(() => {
    // Le middleware renvoie ici toute session deja authentifiee (mot de
    // passe ou magic link) mais pas encore montee en aal2 -- on saute
    // directement a l'etape TOTP, sans redemander email/mot de passe.
    const supabase = createClient();
    supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
      if (data && data.nextLevel === "aal2" && data.nextLevel !== data.currentLevel) {
        setNeedsTotp(true);
      }
    });
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === "aal2" && aal.nextLevel !== aal.currentLevel) {
      setLoading(false);
      setNeedsTotp(true);
      return;
    }

    router.push(await landingRouteForRole(supabase, data.user.id));
    router.refresh();
  }

  async function handleTotpSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const factorId = factors?.totp?.[0]?.id;
    if (!factorId) {
      setError("Aucun facteur de double authentification trouvé.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: totpCode.trim(),
    });

    if (error) {
      setError("Code invalide, réessayez.");
      setLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    router.push(user ? await landingRouteForRole(supabase, user.id) : "/cours");
    router.refresh();
  }

  return (
    <main className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      <div className="flex items-center justify-center p-8 md:p-12">
        <div className="w-full max-w-[380px]">
          <div
            className="mb-9 inline-block rounded-[12px] px-4 py-2.5"
            style={{ background: "var(--logo-plate)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-atlaslab.png" alt="AtlasLab" className="block h-[78px] w-auto" />
          </div>

          {needsTotp ? (
            <>
              <h1 className="mb-2 text-[30px] font-extrabold tracking-[-0.03em]">Vérification en deux étapes</h1>
              <p className="mb-7 text-[14.5px]" style={{ color: "var(--text-muted)" }}>
                Entrez le code à 6 chiffres de votre application d&apos;authentification.
              </p>
              <form onSubmit={handleTotpSubmit} className="flex flex-col gap-4">
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  autoFocus
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  className="input text-center text-lg tracking-[0.3em]"
                  placeholder="123456"
                />
                {error && (
                  <p className="text-sm" style={{ color: "var(--error)" }}>
                    {error}
                  </p>
                )}
                <button type="submit" disabled={loading || totpCode.length < 6} className="btn-primary w-full">
                  {loading ? "Vérification..." : "Vérifier"}
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="mb-2 text-[30px] font-extrabold tracking-[-0.03em]">Connexion à votre espace</h1>
              <p className="mb-7 text-[14.5px]" style={{ color: "var(--text-muted)" }}>
                {dict.login.subtitle}
              </p>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                {error && (
                  <p className="text-sm" style={{ color: "var(--error)" }}>
                    {error}
                  </p>
                )}
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? dict.login.submitting : dict.login.submit}
                </button>
                <div className="flex items-center justify-between text-[13.5px]">
                  <Link href="/forgot-password" style={{ color: "var(--text-muted)" }}>
                    {dict.login.forgotPassword}
                  </Link>
                  <Link href="/inscription-etablissement" className="font-semibold" style={{ color: "var(--accent)" }}>
                    {dict.login.signupTenant}
                  </Link>
                </div>
              </form>
            </>
          )}

          <div className="mt-9">
            <LanguageSwitcher variant="pill" />
          </div>
        </div>
      </div>

      <div
        className="hidden items-center justify-center border-l p-12 md:flex"
        style={{ background: "linear-gradient(150deg,#eaf7f0,#ffffff)", borderColor: "var(--line)" }}
      >
        <div className="max-w-[440px]">
          <p className="mb-[18px] text-xs font-bold tracking-[0.12em]" style={{ color: "var(--accent)" }}>
            LABORATOIRES VIRTUELS
          </p>
          <svg
            viewBox="0 0 520 320"
            className="block w-full rounded-[14px] border"
            style={{ background: "var(--surface-2)", borderColor: "var(--line)" }}
          >
            <defs>
              <pattern id="loginHatch" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                <line x1="0" y1="0" x2="0" y2="8" stroke="#dbe8e1" strokeWidth="4" />
              </pattern>
            </defs>
            <rect width="520" height="320" fill="url(#loginHatch)" />
            <text x="260" y="160" textAnchor="middle" fontFamily="monospace" fontSize="12" fill="#8a9c92" letterSpacing="1.4">
              CAPTURE — SIMULATION DE CIRCUIT
            </text>
          </svg>
          <p className="mt-[22px] text-base leading-[1.6]" style={{ color: "var(--text-3)" }}>
            Simulez un circuit analogique ou logique directement depuis la leçon, sans matériel et même hors connexion.
          </p>
        </div>
      </div>
    </main>
  );
}
