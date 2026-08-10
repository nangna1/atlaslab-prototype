import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFraisApplicablesPourEleve } from "@/lib/frais-data";
import { formatMontantCFA } from "@/lib/format";
import { getLearnerCourses, getResumeTargetFromCourses } from "@/lib/learner-dashboard-data";
import NotificationBell from "./cours/NotificationBell";
import SignOutButton from "./cours/SignOutButton";
import AppSidebarNav, { type NavLink } from "./AppSidebarNav";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Coquille partagee de toutes les pages authentifiees (redesign 2026-08-10,
// voir handoff design section "2. Coquille applicative"). Remplace l'ancienne
// barre horizontale qui n'existait que sur /cours (app/cours/page.tsx) et
// les liens "<- Retour a mes cours" repetes sur chaque page.
//
// Fait ici, une seule fois, le fetch que chaque page authentifiee dupliquait
// (profil/tenant) - accepte comme compromis deliberé pour une refonte en une
// passe plutot qu'un refactor de la recuperation de donnees (certaines pages
// re-fetchent encore profil/tenant pour leurs propres besoins, ex.
// couleur_primaire en style inline - inchange).
export default async function AppSidebar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("nom, role, tenant_id, est_moderateur")
    .eq("id", user.id)
    .single();

  const { data: tenant } = profile?.tenant_id
    ? await supabase.from("tenants").select("nom, logo_url").eq("id", profile.tenant_id).single()
    : { data: null };

  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, titre, message, lien, lu, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  const { count: unreadMessages } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", user.id)
    .eq("lu", false);

  const role = profile?.role ?? null;
  const isApprenant = role === "apprenant";
  const isParent = role === "parent";
  const canManageComptes =
    ["admin_tenant", "super_admin"].includes(role ?? "") || (role === "professeur" && !!profile?.est_moderateur);

  let fraisSolde = 0;
  let resumeHref = "/cours";
  if (isApprenant) {
    const [fraisApplicables, courses] = await Promise.all([
      getFraisApplicablesPourEleve(supabase, user.id),
      getLearnerCourses(supabase, user.id),
    ]);
    fraisSolde = fraisApplicables.reduce((sum, f) => sum + f.reste, 0);
    const resume = getResumeTargetFromCourses(courses);
    if (resume) resumeHref = `/cours/${resume.courseId}/lecons/${resume.lessonId}`;
  }

  // "Offres" (annonces de recrutement, voir app/(app)/offres) : visible pour
  // tous les roles authentifies, meme condition que l'ancien lien de la
  // barre horizontale (app/cours/page.tsx avant deplacement).
  const offresLink: NavLink = { href: "/offres", label: "Offres" };
  const messagesLink: NavLink = { href: "/messages", label: "Messages", badge: unreadMessages ?? 0 };

  const links: NavLink[] = isApprenant
    ? [
        { href: "/cours", label: "Tableau de bord" },
        { href: "/cours/catalogue", label: "Catalogue" },
        { href: resumeHref, label: "Leçon en cours" },
        { href: "/mes-frais", label: "Mes frais" },
        { href: "/emploi-du-temps", label: "Emploi du temps" },
        offresLink,
        messagesLink,
        { href: "/securite", label: "Sécurité" },
        { href: "/profil", label: "Profil" },
      ]
    : isParent
      ? [
          { href: "/portail-parent", label: "Portail parent" },
          offresLink,
          messagesLink,
          { href: "/securite", label: "Sécurité" },
          { href: "/profil", label: "Profil" },
        ]
      : [
          { href: "/cours", label: "Mes cours" },
          { href: "/emploi-du-temps", label: "Emploi du temps" },
          offresLink,
          messagesLink,
          { href: "/securite", label: "Sécurité" },
          { href: "/profil", label: "Profil" },
          ...(canManageComptes ? [{ href: "/admin", label: "Admin" } as NavLink] : []),
        ];

  const initials = (profile?.nom ?? "?")
    .split(" ")
    .map((p: string) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside
      className="box-border flex h-screen flex-col gap-[26px] overflow-y-auto px-4 py-5"
      style={{ background: "var(--bg-panel)", borderRight: "1px solid var(--line)", position: "sticky", top: 0 }}
    >
      <div className="px-2">
        <div className="mb-2 rounded-[10px] px-3 py-2" style={{ background: "var(--logo-plate)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={tenant?.logo_url || "/logo-atlaslab.png"}
            alt={tenant?.nom || "AtlasLab"}
            className="mx-auto block h-[52px] w-auto"
          />
        </div>
        <div className="text-[11px]" style={{ color: "var(--text-faint)" }}>
          {tenant?.nom ?? ""}
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between overflow-y-auto">
        <div className="flex flex-col gap-[3px]">
          <AppSidebarNav links={links} />
          <NotificationBell notifications={notifications ?? []} />
        </div>

        <div className="mt-[14px] flex flex-col gap-[14px]">
          {isApprenant && (
            <div className="rounded-xl p-[14px]" style={{ background: "var(--ok-bg)", border: "1px solid var(--line-accent)" }}>
              <p className="mb-1 text-[11px] font-bold tracking-[0.1em]" style={{ color: "var(--accent)" }}>
                FRAIS
              </p>
              <p className="nowrap mb-2.5 text-[13px]" style={{ color: "var(--text-muted)" }}>
                {formatMontantCFA(fraisSolde)} restants
              </p>
              <Link href="/mes-frais" className="block w-full rounded-lg py-2 text-center text-[13px] font-bold" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
                Payer
              </Link>
            </div>
          )}

          {/* Pastille de langue - visuelle uniquement ici (decision produit :
              le francais post-connexion reste code en dur, voir
              lib/i18n/dictionaries.ts qui ne couvre que connexion/inscription).
              Le vrai selecteur fonctionnel (LanguageSwitcher variant="pill")
              n'est branche que sur l'ecran de connexion. */}
          <div className="flex gap-1 rounded-full p-1" style={{ background: "var(--surface-3)" }}>
            <span className="flex-1 rounded-full py-[5px] text-center text-[11.5px] font-bold" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
              FR
            </span>
            <span className="flex-1 rounded-full py-[5px] text-center text-[11.5px]" style={{ color: "var(--text-muted)" }}>
              EN
            </span>
            <span
              className="flex-1 rounded-full py-[5px] text-center text-[11.5px]"
              style={{ color: "var(--text-muted)", fontFamily: "var(--font-arabic)" }}
            >
              عربي
            </span>
          </div>

          <div className="flex items-center gap-2.5 border-t px-2 pt-2" style={{ borderColor: "var(--line)" }}>
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
              style={{ background: "var(--avatar-bg)", color: "var(--text-2)" }}
            >
              {initials}
            </div>
            <div className="min-w-0 leading-[1.3]">
              <div className="truncate text-[13px] font-semibold">{profile?.nom ?? ""}</div>
              <div className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                {isApprenant ? "Apprenant" : isParent ? "Parent" : "Personnel"}
              </div>
            </div>
          </div>
          <SignOutButton action={signOut} />
        </div>
      </div>
    </aside>
  );
}
