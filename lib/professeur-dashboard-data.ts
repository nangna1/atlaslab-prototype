import type { SupabaseClient } from "@supabase/supabase-js";

// Donnees du tableau de bord professeur (2026-08-11, demande utilisateur :
// "un tableau de bord adapte a chaque utilisateur"). Avant ce fichier, un
// professeur voyait exactement la meme liste generique de cours que
// admin_tenant/super_admin (app/(app)/cours/page.tsx) - aucune vue
// personnelle (ses cours, ses eleves, ce qu'il doit corriger).
//
// Distinct de lib/dashboard-data.ts (staff, tenant entier, utilise par
// /admin/tableau-de-bord) et de lib/learner-dashboard-data.ts (apprenant) :
// ici tout est scope aux cours ou courses.professeur_id = l'appelant, pas
// au tenant entier - un professeur ne doit voir que SES eleves/devoirs, pas
// ceux de ses collegues (contrairement au tableau de bord admin, qui lui
// est bien tenant-entier par conception).

export type CoursEnseigne = {
  id: string;
  titre: string;
  filiere: string | null;
  totalLecons: number;
  totalEleves: number;
  progressionMoyenne: number;
};

type LessonRow = { id: string };
type ModuleRow = { lessons: LessonRow[] | null };
type CourseRow = { id: string; titre: string; filiere: string | null; modules: ModuleRow[] | null };

export async function getCoursEnseignes(supabase: SupabaseClient, professeurId: string): Promise<CoursEnseigne[]> {
  const { data: courses } = await supabase
    .from("courses")
    .select("id, titre, filiere, modules(lessons(id))")
    .eq("professeur_id", professeurId);

  const rows = (courses ?? []) as unknown as CourseRow[];
  if (rows.length === 0) return [];

  const courseIds = rows.map((c) => c.id);
  const { data: enrollments } = await supabase.from("enrollments").select("course_id, user_id").in("course_id", courseIds);

  const elevesParCours = new Map<string, Set<string>>();
  for (const e of enrollments ?? []) {
    if (!elevesParCours.has(e.course_id)) elevesParCours.set(e.course_id, new Set());
    elevesParCours.get(e.course_id)!.add(e.user_id);
  }

  const allLessonIds = rows.flatMap((c) => (c.modules ?? []).flatMap((m) => m.lessons ?? []).map((l) => l.id));
  const allEleveIds = [...new Set((enrollments ?? []).map((e) => e.user_id))];

  const { data: progressRows } =
    allLessonIds.length > 0 && allEleveIds.length > 0
      ? await supabase
          .from("progress")
          .select("user_id, lesson_id")
          .eq("statut", "termine")
          .in("lesson_id", allLessonIds)
          .in("user_id", allEleveIds)
      : { data: [] };

  const termineParEleve = new Map<string, Set<string>>();
  for (const p of progressRows ?? []) {
    if (!termineParEleve.has(p.user_id)) termineParEleve.set(p.user_id, new Set());
    termineParEleve.get(p.user_id)!.add(p.lesson_id);
  }

  return rows.map((course) => {
    const lessonIds = (course.modules ?? []).flatMap((m) => m.lessons ?? []).map((l) => l.id);
    const eleves = elevesParCours.get(course.id) ?? new Set<string>();
    let sommePct = 0;
    for (const eleveId of eleves) {
      const termine = termineParEleve.get(eleveId) ?? new Set<string>();
      const nbTermine = lessonIds.filter((id) => termine.has(id)).length;
      sommePct += lessonIds.length > 0 ? (nbTermine / lessonIds.length) * 100 : 0;
    }
    return {
      id: course.id,
      titre: course.titre,
      filiere: course.filiere,
      totalLecons: lessonIds.length,
      totalEleves: eleves.size,
      progressionMoyenne: eleves.size > 0 ? Math.round(sommePct / eleves.size) : 0,
    };
  });
}

export type ProfDashboardStats = {
  coursCount: number;
  elevesCount: number;
  devoirsACorrigerCount: number;
  seancesAVenirCount: number;
};

export type DevoirACorriger = {
  submissionId: string;
  assignmentTitre: string;
  courseTitre: string;
  courseId: string;
  lessonId: string;
  eleveNom: string;
  submittedAt: string;
};

// Reprend les cours deja calcules par getCoursEnseignes plutot que de
// re-interroger courses/modules/lessons une deuxieme fois.
export async function getProfDashboardStats(
  supabase: SupabaseClient,
  professeurId: string,
  cours: CoursEnseigne[],
): Promise<ProfDashboardStats> {
  const coursIds = cours.map((c) => c.id);
  const elevesUniques = new Set<string>();
  if (coursIds.length > 0) {
    const { data: enrollments } = await supabase.from("enrollments").select("user_id").in("course_id", coursIds);
    for (const e of enrollments ?? []) elevesUniques.add(e.user_id);
  }

  let devoirsACorrigerCount = 0;
  if (coursIds.length > 0) {
    const { data: assignments } = await supabase
      .from("assignments")
      .select("id, lessons(module_id, modules(course_id))");
    const assignmentIdsDesCours = ((assignments ?? []) as unknown as {
      id: string;
      lessons: { modules: { course_id: string } | null } | null;
    }[])
      .filter((a) => a.lessons?.modules?.course_id && coursIds.includes(a.lessons.modules.course_id))
      .map((a) => a.id);

    if (assignmentIdsDesCours.length > 0) {
      const { count } = await supabase
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .in("assignment_id", assignmentIdsDesCours)
        .is("note", null);
      devoirsACorrigerCount = count ?? 0;
    }
  }

  let seancesAVenirCount = 0;
  if (coursIds.length > 0) {
    const { count } = await supabase
      .from("live_sessions")
      .select("id", { count: "exact", head: true })
      .in("course_id", coursIds)
      .gte("date_heure", new Date().toISOString());
    seancesAVenirCount = count ?? 0;
  }

  return {
    coursCount: cours.length,
    elevesCount: elevesUniques.size,
    devoirsACorrigerCount,
    seancesAVenirCount,
  };
}

export async function getDevoirsACorriger(
  supabase: SupabaseClient,
  professeurId: string,
  cours: CoursEnseigne[],
): Promise<DevoirACorriger[]> {
  const coursById = new Map(cours.map((c) => [c.id, c.titre]));
  const coursIds = cours.map((c) => c.id);
  if (coursIds.length === 0) return [];

  const { data: assignments } = await supabase
    .from("assignments")
    .select("id, titre, lesson_id, lessons(id, module_id, modules(course_id))");
  const assignmentsDesCours = ((assignments ?? []) as unknown as {
    id: string;
    titre: string;
    lesson_id: string;
    lessons: { modules: { course_id: string } | null } | null;
  }[]).filter((a) => a.lessons?.modules?.course_id && coursIds.includes(a.lessons.modules.course_id));

  if (assignmentsDesCours.length === 0) return [];
  const assignmentById = new Map(assignmentsDesCours.map((a) => [a.id, a]));

  const { data: submissions } = await supabase
    .from("submissions")
    .select("id, assignment_id, submitted_at, users(nom)")
    .in("assignment_id", assignmentsDesCours.map((a) => a.id))
    .is("note", null)
    .order("submitted_at", { ascending: true })
    .limit(10);

  return ((submissions ?? []) as unknown as { id: string; assignment_id: string; submitted_at: string; users: { nom: string } | null }[])
    .map((s) => {
      const assignment = assignmentById.get(s.assignment_id);
      const courseId = assignment?.lessons?.modules?.course_id ?? "";
      return {
        submissionId: s.id,
        assignmentTitre: assignment?.titre ?? "Devoir",
        courseTitre: coursById.get(courseId) ?? "",
        courseId,
        lessonId: assignment?.lesson_id ?? "",
        eleveNom: s.users?.nom ?? "—",
        submittedAt: s.submitted_at,
      };
    })
    .filter((d) => d.courseId && d.lessonId);
}
