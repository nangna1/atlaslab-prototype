import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CreateCourseForm from "./CreateCourseForm";
import ImportCourseForm from "./ImportCourseForm";
import { matchesQuery } from "@/lib/search";
import {
  getLearnerCourses,
  getLearnerStats,
  getResumeTargetFromCourses,
  getUpcomingAssignments,
  getWeekAgenda,
} from "@/lib/learner-dashboard-data";

export default async function CoursListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; statut?: string }>;
}) {
  const { q: qRaw, statut } = await searchParams;
  const q = (qRaw ?? "").trim();
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

  // Cette page (creation/import de cours, liste "Mes cours"...) n'a pas de
  // sens pour un parent -- son espace dedie est /portail-parent.
  if (profile?.role === "parent") redirect("/portail-parent");

  const isApprenant = profile?.role === "apprenant";
  const isStaff = ["professeur", "admin_tenant", "super_admin"].includes(profile?.role ?? "");

  const { data: tenant } = profile?.tenant_id
    ? await supabase.from("tenants").select("couleur_primaire").eq("id", profile.tenant_id).single()
    : { data: null };

  if (isApprenant) {
    const courses = await getLearnerCourses(supabase, user.id);
    const [stats, agenda, devoirs] = await Promise.all([
      getLearnerStats(supabase, user.id, courses),
      getWeekAgenda(supabase, user.id),
      getUpcomingAssignments(supabase, user.id),
    ]);
    const resume = getResumeTargetFromCourses(courses);
    const filtre = statut === "termine" ? "termine" : "en_cours";
    const coursAffiches = courses.filter((c) => (filtre === "termine" ? c.pct === 100 : c.pct < 100));
    const prenom = (profile?.nom ?? "").split(" ")[0] || "";

    return (
      <div
        className="px-5 pt-6 pb-10 lg:px-10 lg:pt-9 lg:pb-14"
        style={{ "--brand": tenant?.couleur_primaire || undefined } as React.CSSProperties}
      >
        <div className="mb-[30px] flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="mb-2 text-[13px] font-semibold" style={{ color: "var(--accent)" }}>
              Bonjour {prenom}
            </p>
            <h1 className="text-[38px] leading-tight font-extrabold tracking-[-0.03em]">
              Reprenez là où vous vous êtes arrêté
            </h1>
          </div>
          <div className="flex gap-3">
            {resume && (
              <Link href={`/cours/${resume.courseId}/lecons/${resume.lessonId}`} className="btn-primary">
                Reprendre la leçon
              </Link>
            )}
            <Link href="/cours/catalogue" className="btn-secondary">
              Parcourir le catalogue
            </Link>
          </div>
        </div>

        <div className="mb-7 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: "Cours suivis", value: String(stats.coursSuivisCount), hint: null },
            { label: "Progression", value: `${stats.progressionGlobalePct} %`, hint: null },
            { label: "Devoirs rendus", value: `${stats.devoirsRendus}/${stats.devoirsTotal}`, hint: null },
            { label: "Labos terminés", value: String(stats.labosTermines), hint: null },
          ].map((s) => (
            <div key={s.label} className="card">
              <p className="mb-3 text-[13px]" style={{ color: "var(--text-muted)" }}>
                {s.label}
              </p>
              <p className="text-[32px] font-extrabold tracking-[-0.02em]">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-extrabold">Mes cours</h2>
              <div className="flex gap-2">
                <Link
                  href="/cours?statut=en_cours"
                  className="rounded-full px-3.5 py-1.5 text-xs"
                  style={{
                    background: filtre === "en_cours" ? "var(--line)" : "transparent",
                    color: filtre === "en_cours" ? "var(--text)" : "var(--text-muted)",
                  }}
                >
                  En cours
                </Link>
                <Link
                  href="/cours?statut=termine"
                  className="rounded-full px-3.5 py-1.5 text-xs"
                  style={{
                    background: filtre === "termine" ? "var(--line)" : "transparent",
                    color: filtre === "termine" ? "var(--text)" : "var(--text-muted)",
                  }}
                >
                  Terminés
                </Link>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {coursAffiches.length === 0 && (
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  {filtre === "termine" ? "Aucun cours terminé pour le moment." : "Aucun cours en cours."}
                </p>
              )}
              {coursAffiches.map((c) => (
                <Link
                  key={c.id}
                  href={`/cours/${c.id}`}
                  className="grid grid-cols-[56px_1fr_auto] items-center gap-[18px] rounded-2xl border p-[18px_20px] transition-colors"
                  style={{ borderColor: "var(--line)", background: "var(--surface)" }}
                >
                  <span
                    className="flex h-14 w-14 items-center justify-center rounded-xl text-[11px] font-bold tracking-[0.06em]"
                    style={{ background: "var(--line)", color: "var(--accent)" }}
                  >
                    {c.code}
                  </span>
                  <span className="block min-w-0">
                    <span className="mb-1 block text-xs" style={{ color: "var(--text-muted)" }}>
                      {c.filiere} · {c.totalLessons} leçon(s)
                    </span>
                    <span className="mb-2.5 block truncate text-[17px] font-bold">{c.titre}</span>
                    <span
                      className="block h-1.5 max-w-[420px] overflow-hidden rounded-full"
                      style={{ background: "var(--line)" }}
                    >
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${c.pct}%`, background: "linear-gradient(90deg,var(--accent-deep),var(--accent))" }}
                      />
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block text-xl font-extrabold">{c.pct}%</span>
                    <span className="mt-1 block text-xs" style={{ color: "var(--text-muted)" }}>
                      {c.nextLessonTitre ?? "Terminé"}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="card">
              <h3 className="mb-3.5 text-[15px] font-bold">Cette semaine</h3>
              {agenda.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Aucune séance en direct cette semaine.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {agenda.map((a) => (
                    <div key={a.id} className="flex items-start gap-3">
                      <div className="min-w-[52px] rounded-lg py-1.5 text-center" style={{ background: "var(--line)" }}>
                        <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                          {a.jour}
                        </div>
                        <div className="text-sm font-bold">{a.heure}</div>
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{a.titre}</p>
                        {a.lieu && (
                          <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                            {a.lieu}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="card">
              <h3 className="mb-3 text-[15px] font-bold">Devoirs à rendre</h3>
              {devoirs.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Aucun devoir en attente.
                </p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {devoirs.map((d) => (
                    <div key={d.id} className="flex justify-between gap-3 text-[13px]">
                      <span>{d.titre}</span>
                      <span className="nowrap" style={{ color: "var(--text-muted)" }}>
                        {d.dateLimite
                          ? new Date(d.dateLimite).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
                          : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Branche staff (professeur/admin_tenant/super_admin) : comportement
  // identique a avant le redesign (creation/import de cours, liste complete,
  // recherche), seule l'ancienne barre horizontale de nav a disparu (la
  // sidebar la remplace, voir app/(app)/AppSidebar.tsx).
  const { data: allCourses } = await supabase
    .from("courses")
    .select("id, titre, filiere, modules(id)")
    .order("titre");
  const courses = q
    ? (allCourses ?? []).filter((c) => matchesQuery(c.titre, q) || matchesQuery(c.filiere, q))
    : allCourses;

  return (
    <div
      className="mx-auto max-w-3xl px-6 py-10"
      style={{ "--brand": tenant?.couleur_primaire || undefined } as React.CSSProperties}
    >
      <h1 className="mb-6 text-2xl font-bold">Mes cours</h1>

      {isStaff && (
        <div className="mb-8 flex flex-col gap-4">
          <CreateCourseForm />
          <ImportCourseForm />
        </div>
      )}

      <form method="get" className="mb-6">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Rechercher un cours (titre, filière)…"
          className="input max-w-sm"
        />
      </form>

      {(courses ?? []).length === 0 && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {q ? `Aucun cours ne correspond à « ${q} ».` : "Aucun cours pour le moment."}
        </p>
      )}

      <div className="flex flex-col gap-4">
        {(courses ?? []).map((course) => (
          <Link key={course.id} href={`/cours/${course.id}`} className="card-link">
            <p className="text-xs font-medium tracking-[0.06em] uppercase" style={{ color: "var(--text-muted)" }}>
              {course.filiere} · {course.modules?.length ?? 0} module(s)
            </p>
            <h2 className="mt-1 text-lg font-semibold">{course.titre}</h2>
          </Link>
        ))}
      </div>
    </div>
  );
}
