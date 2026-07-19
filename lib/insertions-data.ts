import type { SupabaseClient } from "@supabase/supabase-js";
import { isValidInsertionStatut, NON_RENSEIGNE, type InsertionStatut } from "@/lib/insertions";

export type DiplomeInsertion = {
  userId: string;
  userNom: string;
  courseId: string;
  courseTitre: string;
  dateObtention: string;
  statut: InsertionStatut | typeof NON_RENSEIGNE;
  entreprise: string | null;
  poste: string | null;
};

type CourseWithModules = { id: string; titre: string; modules: { lessons: { id: string }[] | null }[] | null };

// Un cours n'a pas de statut "termine" persiste : on le derive, comme sur la page
// certificat, en verifiant que toutes les lecons du cours ont progress.statut = 'termine'
// pour l'eleve. Pas de filtre tenant explicite : RLS (staff = tenant de l'appelant).
export async function getDiplomesInsertions(supabase: SupabaseClient): Promise<DiplomeInsertion[]> {
  const { data: courses } = await supabase
    .from("courses")
    .select("id, titre, modules(lessons(id))");
  const { data: users } = await supabase.from("users").select("id, nom, role");
  const eleves = (users ?? []).filter((u) => u.role === "apprenant");

  const { data: progressRows } = await supabase
    .from("progress")
    .select("user_id, lesson_id, updated_at")
    .eq("statut", "termine");

  const { data: insertions } = await supabase
    .from("insertions_professionnelles")
    .select("user_id, course_id, statut, entreprise, poste");
  const insertionMap = new Map(
    (insertions ?? []).map((i) => [`${i.user_id}::${i.course_id}`, i]),
  );

  const diplomes: DiplomeInsertion[] = [];

  for (const course of (courses ?? []) as CourseWithModules[]) {
    const lessonIds = (course.modules ?? []).flatMap((m) => (m.lessons ?? []).map((l) => l.id));
    if (lessonIds.length === 0) continue;

    for (const eleve of eleves) {
      const completed = (progressRows ?? []).filter(
        (p) => p.user_id === eleve.id && lessonIds.includes(p.lesson_id),
      );
      if (completed.length !== lessonIds.length) continue;

      const dateObtention = completed.reduce(
        (max, r) => (r.updated_at > max ? r.updated_at : max),
        completed[0].updated_at,
      );

      const existing = insertionMap.get(`${eleve.id}::${course.id}`);
      diplomes.push({
        userId: eleve.id,
        userNom: eleve.nom,
        courseId: course.id,
        courseTitre: course.titre,
        dateObtention,
        statut: existing && isValidInsertionStatut(existing.statut) ? existing.statut : NON_RENSEIGNE,
        entreprise: existing?.entreprise ?? null,
        poste: existing?.poste ?? null,
      });
    }
  }

  diplomes.sort((a, b) => b.dateObtention.localeCompare(a.dateObtention));
  return diplomes;
}
