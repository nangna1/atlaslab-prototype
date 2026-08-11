import type { SupabaseClient } from "@supabase/supabase-js";

// Donnees du "Tableau de bord" apprenant (redesign 2026-08-10, voir handoff
// design). Fichier separe de lib/dashboard-data.ts, qui reste dedie au
// tableau de bord STAFF (recap tous eleves/profs du tenant, requetes non
// scopees par utilisateur) - deux consommateurs et deux postures RLS
// differentes, pas la meme fonction a etendre.
//
// Toutes les requetes passent par le client de session normal (jamais
// createAdminClient) : enrollments/courses/modules/lessons/progress/
// assignments/submissions sont deja scopees correctement par les policies
// RLS existantes pour un apprenant (voir supabase/migrations/
// 20260717040000_apprenant_enrollment_restriction.sql), meme principe que
// lib/frais-data.ts et lib/dashboard-data.ts.

export type CoursSuivi = {
  id: string;
  titre: string;
  filiere: string | null;
  code: string;
  totalModules: number;
  totalLessons: number;
  termine: number;
  pct: number;
  nextLessonId: string | null;
  nextLessonTitre: string | null;
};

export type ResumeTarget = { courseId: string; lessonId: string; courseTitre: string } | null;

type LessonRow = { id: string; titre: string; ordre: number; type: string };
type ModuleRow = { id: string; ordre: number; lessons: LessonRow[] | null };
type CourseRow = { id: string; titre: string; filiere: string | null; modules: ModuleRow[] | null };

// Code 3 lettres affiche sur la carte de cours (ex: "ELC", "LOG") - le
// schema n'a pas de champ dedie pour ca (juste titre/filiere), donc derive
// deterministe du titre plutot qu'invente une abreviation qui n'existe nulle
// part en base.
function deriveCode(titre: string): string {
  const letters = titre.replace(/[^\p{L}]/gu, "").toUpperCase();
  return letters.slice(0, 3) || "CRS";
}

async function fetchEnrolledCourses(supabase: SupabaseClient, userId: string) {
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("course_id, courses(id, titre, filiere, modules(id, ordre, lessons(id, titre, ordre, type)))")
    .eq("user_id", userId);

  const courses = ((enrollments ?? []) as unknown as { course_id: string; courses: CourseRow | null }[])
    .map((e) => e.courses)
    .filter((c): c is CourseRow => c !== null);

  const allLessonIds = courses.flatMap((c) => (c.modules ?? []).flatMap((m) => (m.lessons ?? []).map((l) => l.id)));

  const { data: progress } =
    allLessonIds.length > 0
      ? await supabase
          .from("progress")
          .select("lesson_id")
          .eq("user_id", userId)
          .eq("statut", "termine")
          .in("lesson_id", allLessonIds)
      : { data: [] };
  const termineIds = new Set((progress ?? []).map((p) => p.lesson_id));

  return { courses, termineIds };
}

export async function getLearnerCourses(supabase: SupabaseClient, userId: string): Promise<CoursSuivi[]> {
  const { courses, termineIds } = await fetchEnrolledCourses(supabase, userId);

  return courses.map((course) => {
    const modules = [...(course.modules ?? [])].sort((a, b) => a.ordre - b.ordre);
    const lessons = modules.flatMap((m) => [...(m.lessons ?? [])].sort((a, b) => a.ordre - b.ordre));
    const termine = lessons.filter((l) => termineIds.has(l.id)).length;
    const nextLesson = lessons.find((l) => !termineIds.has(l.id)) ?? null;

    return {
      id: course.id,
      titre: course.titre,
      filiere: course.filiere,
      code: deriveCode(course.titre),
      totalModules: modules.length,
      totalLessons: lessons.length,
      termine,
      pct: lessons.length > 0 ? Math.round((termine / lessons.length) * 100) : 0,
      nextLessonId: nextLesson?.id ?? null,
      nextLessonTitre: nextLesson?.titre ?? null,
    };
  });
}

// Prochaine lecon non terminee, tous cours confondus (ordre d'inscription
// puis ordre des modules/lecons) - alimente a la fois le CTA "Reprendre la
// lecon" du tableau de bord et l'entree "Lecon en cours" de la sidebar, pour
// que les deux ne se contredisent jamais (une seule source de verite).
export function getResumeTargetFromCourses(courses: CoursSuivi[]): ResumeTarget {
  const withNext = courses.find((c) => c.nextLessonId);
  if (!withNext || !withNext.nextLessonId) return null;
  return { courseId: withNext.id, lessonId: withNext.nextLessonId, courseTitre: withNext.titre };
}

export type LearnerStats = {
  coursSuivisCount: number;
  progressionGlobalePct: number;
  devoirsRendus: number;
  devoirsTotal: number;
  labosTermines: number;
};

// "Heures de labo" de la maquette est impossible a calculer honnetement : le
// schema n'a aucune colonne de duree/temps passe (verifie sur lessons/
// progress/live_sessions). Remplace par un compteur reel : nombre de lecons
// de type 'labo' marquees terminees, cf. plan de redesign.
export async function getLearnerStats(
  supabase: SupabaseClient,
  userId: string,
  courses: CoursSuivi[],
): Promise<LearnerStats> {
  const totalLessons = courses.reduce((sum, c) => sum + c.totalLessons, 0);
  const termine = courses.reduce((sum, c) => sum + c.termine, 0);

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("courses(modules(lessons(id, type, assignments(id, titre, date_limite))))")
    .eq("user_id", userId);

  type LessonWithAssignments = { id: string; type: string; assignments: { id: string }[] | null };
  type ModuleRow2 = { lessons: LessonWithAssignments[] | null };
  type CourseRow2 = { modules: ModuleRow2[] | null };

  const allLessons = ((enrollments ?? []) as unknown as { courses: CourseRow2 | null }[])
    .flatMap((e) => e.courses?.modules ?? [])
    .flatMap((m) => m.lessons ?? []);

  const laboLessonIds = allLessons.filter((l) => l.type === "labo").map((l) => l.id);
  const allAssignmentIds = allLessons.flatMap((l) => (l.assignments ?? []).map((a) => a.id));

  const [{ data: laboProgress }, { data: submissions }] = await Promise.all([
    laboLessonIds.length > 0
      ? supabase
          .from("progress")
          .select("lesson_id")
          .eq("user_id", userId)
          .eq("statut", "termine")
          .in("lesson_id", laboLessonIds)
      : Promise.resolve({ data: [] }),
    allAssignmentIds.length > 0
      ? supabase.from("submissions").select("assignment_id").eq("user_id", userId).in("assignment_id", allAssignmentIds)
      : Promise.resolve({ data: [] }),
  ]);

  return {
    coursSuivisCount: courses.length,
    progressionGlobalePct: totalLessons > 0 ? Math.round((termine / totalLessons) * 100) : 0,
    devoirsRendus: (submissions ?? []).length,
    devoirsTotal: allAssignmentIds.length,
    labosTermines: (laboProgress ?? []).length,
  };
}

export type AgendaItem = { id: string; jour: string; heure: string; titre: string; lieu: string };

const JOURS_COURTS = ["DIM", "LUN", "MAR", "MER", "JEU", "VEN", "SAM"];

// Uniquement live_sessions (date_heure reelle) - creneaux_horaires est un
// gabarit hebdomadaire sans date absolue (jour 0-6 seulement), en surfacer
// "cette semaine" reviendrait a inventer des dates que le schema ne
// contient pas (meme logique que pour "heures de labo" ci-dessus).
export async function getWeekAgenda(supabase: SupabaseClient, userId: string): Promise<AgendaItem[]> {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = dimanche
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() + diffToMonday);
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);

  const { data: enrollments } = await supabase.from("enrollments").select("course_id").eq("user_id", userId);
  const courseIds = [...new Set((enrollments ?? []).map((e) => e.course_id))];
  if (courseIds.length === 0) return [];

  const { data: sessions } = await supabase
    .from("live_sessions")
    .select("id, date_heure, lien_visio, courses(titre)")
    .in("course_id", courseIds)
    .gte("date_heure", monday.toISOString())
    .lt("date_heure", nextMonday.toISOString())
    .order("date_heure");

  return ((sessions ?? []) as unknown as { id: string; date_heure: string; lien_visio: string | null; courses: { titre: string } | null }[]).map(
    (s) => {
      const d = new Date(s.date_heure);
      return {
        id: s.id,
        jour: JOURS_COURTS[d.getDay()],
        heure: d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        titre: s.courses?.titre ?? "Séance",
        // live_sessions n'a pas de colonne "salle" (seule creneaux_horaires
        // l'a) - affiche "Visio" si un lien existe plutot que d'inventer un
        // numero de salle.
        lieu: s.lien_visio ? "Visio" : "",
      };
    },
  );
}

export type DevoirARendre = { id: string; titre: string; courseTitre: string; dateLimite: string | null };

export async function getUpcomingAssignments(supabase: SupabaseClient, userId: string): Promise<DevoirARendre[]> {
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("courses(titre, modules(lessons(assignments(id, titre, date_limite))))")
    .eq("user_id", userId);

  type AssignmentRow = { id: string; titre: string; date_limite: string | null };
  type LessonRow2 = { assignments: AssignmentRow[] | null };
  type ModuleRow3 = { lessons: LessonRow2[] | null };
  type CourseRow3 = { titre: string; modules: ModuleRow3[] | null };

  const all: DevoirARendre[] = [];
  for (const e of (enrollments ?? []) as unknown as { courses: CourseRow3 | null }[]) {
    const course = e.courses;
    if (!course) continue;
    for (const m of course.modules ?? []) {
      for (const l of m.lessons ?? []) {
        for (const a of l.assignments ?? []) {
          all.push({ id: a.id, titre: a.titre, courseTitre: course.titre, dateLimite: a.date_limite });
        }
      }
    }
  }
  if (all.length === 0) return [];

  const { data: submissions } = await supabase
    .from("submissions")
    .select("assignment_id")
    .eq("user_id", userId)
    .in("assignment_id", all.map((a) => a.id));
  const submittedIds = new Set((submissions ?? []).map((s) => s.assignment_id));

  return all
    .filter((a) => !submittedIds.has(a.id))
    .sort((a, b) => (a.dateLimite ?? "").localeCompare(b.dateLimite ?? ""))
    .slice(0, 5);
}
