import type { SupabaseClient } from "@supabase/supabase-js";

export type PendingAssignment = { id: string; titre: string; courseTitre: string };

type CourseWithAssignments = {
  titre: string;
  modules: { lessons: { assignments: { id: string; titre: string }[] | null }[] | null }[] | null;
};

// Devoirs des cours de l'eleve pour lesquels aucune soumission n'existe
// encore. Une fois soumis (meme via WhatsApp), l'eleve repasse par
// l'application pour consulter/modifier avant notation.
export async function getPendingAssignments(
  admin: SupabaseClient,
  userId: string,
): Promise<PendingAssignment[]> {
  const { data: enrollments } = await admin.from("enrollments").select("course_id").eq("user_id", userId);
  const courseIds = [...new Set((enrollments ?? []).map((e) => e.course_id))];
  if (courseIds.length === 0) return [];

  const { data: courses } = await admin
    .from("courses")
    .select("titre, modules(lessons(assignments(id, titre)))")
    .in("id", courseIds);

  const all: PendingAssignment[] = [];
  for (const course of (courses ?? []) as CourseWithAssignments[]) {
    for (const m of course.modules ?? []) {
      for (const l of m.lessons ?? []) {
        for (const a of l.assignments ?? []) {
          all.push({ id: a.id, titre: a.titre, courseTitre: course.titre });
        }
      }
    }
  }
  if (all.length === 0) return [];

  const { data: existing } = await admin
    .from("submissions")
    .select("assignment_id")
    .eq("user_id", userId)
    .in("assignment_id", all.map((a) => a.id));
  const submittedIds = new Set((existing ?? []).map((s) => s.assignment_id));

  return all.filter((a) => !submittedIds.has(a.id));
}

export function formatAssignmentList(assignments: PendingAssignment[]): string {
  return assignments.map((a, i) => `${i + 1}. ${a.titre} (${a.courseTitre})`).join("\n");
}
