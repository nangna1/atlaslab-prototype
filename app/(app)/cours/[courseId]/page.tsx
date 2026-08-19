import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EnrollForm from "./EnrollForm";
import AddModuleForm from "./AddModuleForm";
import AddLessonForm from "./AddLessonForm";
import ModuleHeader from "./ModuleHeader";
import LessonRow from "./LessonRow";
import CourseHeader from "../CourseHeader";
import SeanceForm from "./SeanceForm";
import SeanceItem from "./SeanceItem";
import CreneauForm from "./CreneauForm";
import CreneauItem from "./CreneauItem";

const TYPE_LABEL: Record<string, string> = {
  contenu: "📄 Contenu",
  labo: "🔬 Laboratoire",
  quiz: "✅ Quiz",
  seance_directe: "🎥 Séance en direct",
};

type Lesson = {
  id: string;
  titre: string;
  ordre: number;
  type: string;
  contenu_markdown: string | null;
  labo_type: string | null;
  labo_config: { netlist?: string; embed_url?: string } | null;
  quiz_questions: { question: string; options: string[]; correct: number }[] | null;
  piece_jointe_url: string | null;
  piece_jointe_nom: string | null;
  piece_jointe_telechargeable: boolean;
};
type Module = { id: string; titre: string; ordre: number; lessons: Lesson[] | null };

export default async function CoursDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single();
  const isApprenant = profile?.role === "apprenant";
  const isStaff = ["professeur", "admin_tenant", "super_admin"].includes(profile?.role ?? "");

  const { data: tenant } = profile?.tenant_id
    ? await supabase.from("tenants").select("couleur_primaire").eq("id", profile.tenant_id).single()
    : { data: null };

  const { data: course } = await supabase
    .from("courses")
    .select(
      "id, titre, filiere, professeur_id, modules(id, titre, ordre, lessons(id, titre, ordre, type, contenu_markdown, labo_type, labo_config, quiz_questions, piece_jointe_url, piece_jointe_nom, piece_jointe_telechargeable))",
    )
    .eq("id", courseId)
    .single();

  if (!course) return notFound();

  const modules = [...((course.modules ?? []) as Module[])]
    .sort((a, b) => a.ordre - b.ordre)
    .map((module) => ({
      ...module,
      lessons: [...(module.lessons ?? [])].sort((a, b) => a.ordre - b.ordre),
    }));

  const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);

  let termineeIds = new Set<string>();
  if (isApprenant) {
    const courseLessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));
    const { data: progress } =
      courseLessonIds.length > 0
        ? await supabase
            .from("progress")
            .select("lesson_id")
            .eq("user_id", user.id)
            .eq("statut", "termine")
            .in("lesson_id", courseLessonIds)
        : { data: [] };
    termineeIds = new Set((progress ?? []).map((p) => p.lesson_id));
  }

  // Professeur affiche en carte "Professeur" (branche apprenant, voir plus
  // bas) - pas de champ "matiere" distinct dans le schema, la filiere du
  // cours sert de contexte plutot que d'inventer un champ.
  const { data: professeur } = course.professeur_id
    ? await supabase.from("users").select("nom").eq("id", course.professeur_id).single()
    : { data: null };

  type Eleve = { user_id: string; nom: string; email: string | null; termine: number };
  let eleves: Eleve[] = [];
  let candidats: { id: string; nom: string; email: string | null }[] = [];
  if (isStaff) {
    const allLessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));

    const { data: inscriptions } = await supabase
      .from("enrollments")
      .select("user_id, users(nom, email)")
      .eq("course_id", courseId);

    const { data: progressRows } =
      allLessonIds.length > 0
        ? await supabase
            .from("progress")
            .select("user_id, lesson_id")
            .eq("statut", "termine")
            .in("lesson_id", allLessonIds)
        : { data: [] };

    const termineParEleve = new Map<string, number>();
    for (const row of progressRows ?? []) {
      termineParEleve.set(row.user_id, (termineParEleve.get(row.user_id) ?? 0) + 1);
    }

    eleves = ((inscriptions ?? []) as unknown as { user_id: string; users: { nom: string; email: string | null } | null }[]).map(
      (inscription) => ({
        user_id: inscription.user_id,
        nom: inscription.users?.nom ?? "—",
        email: inscription.users?.email ?? null,
        termine: termineParEleve.get(inscription.user_id) ?? 0,
      }),
    );

    const inscritIds = new Set(eleves.map((e) => e.user_id));
    const { data: apprenants } = await supabase
      .from("users")
      .select("id, nom, email")
      .eq("role", "apprenant");
    candidats = (apprenants ?? []).filter((a) => !inscritIds.has(a.id));
  }

  const { data: creneaux } = await supabase
    .from("creneaux_horaires")
    .select("id, jour, heure_debut, heure_fin, salle")
    .eq("course_id", courseId)
    .order("jour")
    .order("heure_debut");

  const { data: seances } = await supabase
    .from("live_sessions")
    .select("id, date_heure, lien_visio, professeur_id")
    .eq("course_id", courseId)
    .order("date_heure");

  const seanceIds = (seances ?? []).map((s) => s.id);
  const { data: attendanceRows } =
    seanceIds.length > 0
      ? await supabase
          .from("attendance")
          .select("live_session_id, user_id, statut")
          .in("live_session_id", seanceIds)
      : { data: [] };

  const monStatutParSeance = new Map<string, string>();
  const attendanceParSeance = new Map<string, Record<string, string>>();
  for (const row of attendanceRows ?? []) {
    if (row.user_id === user.id) monStatutParSeance.set(row.live_session_id, row.statut);
    if (isStaff) {
      const map = attendanceParSeance.get(row.live_session_id) ?? {};
      map[row.user_id] = row.statut;
      attendanceParSeance.set(row.live_session_id, map);
    }
  }

  const brandStyle = { "--brand": tenant?.couleur_primaire || undefined } as React.CSSProperties;

  // Prochaine lecon non terminee de CE cours (pas le resume global multi-
  // cours de la sidebar/tableau de bord, voir lib/learner-dashboard-data.ts)
  // - pour le bouton "Continuer" de la carte de progression.
  const allLessonsOrdered = modules.flatMap((m) => m.lessons);
  const pctCourse = totalLessons > 0 ? Math.round((termineeIds.size / totalLessons) * 100) : 0;
  const prochaineLecon = allLessonsOrdered.find((l) => !termineeIds.has(l.id)) ?? null;

  const creneauxSeancesSection = (
    <>
      <section className="mt-8">
        <h2 className="mb-3 border-b pb-2 text-lg font-semibold" style={{ borderColor: "var(--line)" }}>
          Emploi du temps
        </h2>
        {(creneaux ?? []).length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Aucun créneau défini.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {(creneaux ?? []).map((creneau) => (
              <CreneauItem key={creneau.id} courseId={course.id} creneau={creneau} isStaff={isStaff} />
            ))}
          </div>
        )}
        {isStaff && (
          <div className="mt-3">
            <CreneauForm courseId={course.id} />
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 border-b pb-2 text-lg font-semibold" style={{ borderColor: "var(--line)" }}>
          Séances en direct
        </h2>
        {(seances ?? []).length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Aucune séance programmée.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {(seances ?? []).map((seance) => (
              <SeanceItem
                key={seance.id}
                courseId={course.id}
                seance={seance}
                isStaff={isStaff}
                estProfesseurTitulaire={seance.professeur_id === user.id}
                monStatut={monStatutParSeance.get(seance.id)}
                eleves={isStaff ? eleves.map((e) => ({ user_id: e.user_id, nom: e.nom })) : undefined}
                attendanceParEleve={isStaff ? attendanceParSeance.get(seance.id) ?? {} : undefined}
              />
            ))}
          </div>
        )}
        {isStaff && (
          <div className="mt-3">
            <SeanceForm courseId={course.id} />
          </div>
        )}
      </section>
    </>
  );

  if (isApprenant) {
    return (
      <div style={brandStyle}>
        <div
          className="px-5 pt-6 pb-6 lg:px-10 lg:pt-8 lg:pb-[30px]"
          style={{ background: "linear-gradient(150deg,#eaf7f0,#ffffff)", borderBottom: "1px solid var(--line)" }}
        >
          <Link href="/cours/catalogue" className="mb-4 inline-block text-[13px]" style={{ color: "var(--text-muted)" }}>
            ← Catalogue
          </Link>
          <div className="flex flex-wrap items-end justify-between gap-8">
            <div>
              <div className="mb-3 flex items-center gap-2.5">
                <span
                  className="rounded-full px-3 py-1 text-xs font-bold"
                  style={{ background: "var(--chip-bg)", color: "var(--accent)" }}
                >
                  {course.filiere ?? "—"}
                </span>
                <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>
                  {modules.length} module(s) · {totalLessons} leçon(s)
                </span>
              </div>
              <h1 className="text-[40px] leading-tight font-extrabold tracking-[-0.03em]">{course.titre}</h1>
            </div>
            <div className="min-w-[260px] rounded-2xl border p-5" style={{ borderColor: "var(--line-accent)", background: "var(--surface)" }}>
              <p className="mb-2 text-[13px]" style={{ color: "var(--text-muted)" }}>
                Votre progression
              </p>
              <p className="mb-3 text-[30px] font-extrabold">{pctCourse} %</p>
              <div className="mb-4 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--line)" }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pctCourse}%`, background: "linear-gradient(90deg,var(--accent-deep),var(--accent))" }}
                />
              </div>
              {prochaineLecon ? (
                <Link href={`/cours/${course.id}/lecons/${prochaineLecon.id}`} className="btn-primary w-full">
                  Continuer
                </Link>
              ) : (
                <p className="text-center text-sm font-semibold" style={{ color: "var(--accent)" }}>
                  ✓ Cours terminé
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="grid items-start gap-7 px-5 py-6 lg:grid-cols-[1.7fr_1fr] lg:px-10 lg:py-8">
          <div>
            <h2 className="mb-4 text-[19px] font-extrabold">Programme</h2>
            <div className="flex flex-col gap-3.5">
              {modules.map((module) => {
                const moduleLessons = module.lessons;
                const moduleTermine = moduleLessons.filter((l) => termineeIds.has(l.id)).length;
                const etat =
                  moduleLessons.length === 0
                    ? ""
                    : moduleTermine === moduleLessons.length
                      ? "Terminé"
                      : moduleTermine > 0
                        ? "En cours"
                        : "À venir";
                return (
                  <div key={module.id} className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
                    <div
                      className="flex items-center justify-between gap-4 border-b px-5 py-4"
                      style={{ borderColor: "var(--line-3)" }}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-[26px] w-[26px] items-center justify-center rounded-lg text-xs font-bold"
                          style={{ background: "var(--line)", color: "var(--accent)" }}
                        >
                          {module.ordre}
                        </span>
                        <span className="text-base font-bold">{module.titre}</span>
                      </div>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {etat}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      {moduleLessons.map((lesson) => (
                        <Link
                          key={lesson.id}
                          href={`/cours/${course.id}/lecons/${lesson.id}`}
                          className="flex items-center justify-between gap-4 border-t px-5 py-3 text-sm"
                          style={{ borderColor: "var(--line-3)", color: "var(--text-2)" }}
                        >
                          <span className="flex items-center gap-2.5">
                            <span
                              className="h-[7px] w-[7px] rounded-full"
                              style={{ background: termineeIds.has(lesson.id) ? "var(--accent)" : "var(--inactive-dot)" }}
                            />
                            {lesson.titre}
                          </span>
                          <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                            {TYPE_LABEL[lesson.type]?.replace(/^\S+\s/, "") ?? lesson.type}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            {creneauxSeancesSection}
          </div>

          <div className="flex flex-col gap-4">
            {professeur && (
              <div className="card">
                <h3 className="mb-3.5 text-[15px] font-bold">Professeur</h3>
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-[42px] w-[42px] items-center justify-center rounded-full text-[13px] font-bold"
                    style={{ background: "var(--avatar-bg)", color: "var(--text-2)" }}
                  >
                    {professeur.nom
                      .split(" ")
                      .map((p: string) => p[0])
                      .filter(Boolean)
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{professeur.nom}</p>
                    <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                      {course.filiere}
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className="card">
              <h3 className="mb-3 text-[15px] font-bold">Ressources</h3>
              <Link href={`/cours/${course.id}/imprimer`} className="flex justify-between text-[13.5px]">
                <span>Support de cours</span>
                <span style={{ color: "var(--text-muted)" }}>PDF</span>
              </Link>
            </div>
            <div className="card flex flex-col gap-3">
              <p className="flex flex-wrap items-center gap-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                {termineeIds.size}/{totalLessons} leçon(s) terminée(s)
              </p>
              <Link href={`/cours/${course.id}/bulletin/${user.id}`} className="btn-link text-sm">
                Mon bulletin
              </Link>
              {totalLessons > 0 && termineeIds.size === totalLessons && (
                <div>
                  <h3 className="mb-1.5 text-[15px] font-bold">Certificat</h3>
                  <Link href={`/cours/${course.id}/certificat`} className="btn-link text-sm">
                    🎓 Voir mon certificat
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Branche staff (professeur/admin_tenant/super_admin) : structure et
  // fonctionnalites inchangees (CRUD modules/lecons, creneaux/seances,
  // gestion des inscriptions) - la maquette ne represente pas cette vue,
  // seul l'habillage visuel change (cascade via les tokens de
  // app/globals.css) et le lien "<- Retour" a disparu (redondant avec la
  // sidebar, voir app/(app)/AppSidebar.tsx).
  return (
    <main className="page" style={brandStyle}>
      <CourseHeader courseId={course.id} titre={course.titre} filiere={course.filiere} />
      <Link href={`/cours/${course.id}/imprimer`} className="btn-secondary mb-6 inline-block">
        📄 Télécharger le support de cours (PDF)
      </Link>

      {modules.map((module) => (
        <section key={module.id} className="mt-8">
          <ModuleHeader courseId={course.id} moduleId={module.id} titre={module.titre} />
          <ul className="flex list-none flex-col gap-2 p-0">
            {module.lessons.map((lesson) => (
              <LessonRow key={lesson.id} courseId={course.id} lesson={lesson} />
            ))}
          </ul>
          <AddLessonForm courseId={course.id} moduleId={module.id} />
        </section>
      ))}

      <div className="mt-6">
        <AddModuleForm courseId={course.id} />
      </div>

      {creneauxSeancesSection}

      <section className="mt-10">
        <h2 className="mb-3 border-b pb-2 text-lg font-semibold" style={{ borderColor: "var(--line)" }}>
          Élèves inscrits
        </h2>
        {eleves.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Aucun élève inscrit.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {eleves.map((eleve) => (
              <div
                key={eleve.user_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                style={{ borderColor: "var(--line)", background: "var(--surface)" }}
              >
                <span>{eleve.nom}</span>
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                  {eleve.email ?? "—"}
                </span>
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                  {eleve.termine}/{totalLessons} terminé(s)
                </span>
                <Link href={`/cours/${course.id}/bulletin/${eleve.user_id}`} className="btn-link text-sm">
                  Bulletin
                </Link>
                {totalLessons > 0 && eleve.termine === totalLessons && (
                  <Link href={`/cours/${course.id}/certificat?eleve=${eleve.user_id}`} className="btn-link text-sm">
                    Voir le certificat
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="mt-3">
          <EnrollForm courseId={course.id} candidats={candidats} />
        </div>
      </section>
    </main>
  );
}
