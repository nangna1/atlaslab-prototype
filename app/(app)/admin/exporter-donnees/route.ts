import { NextResponse } from "next/server";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv-export";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Non authentifié.", { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single();

  if (
    !profile ||
    !["admin_tenant", "super_admin"].includes(profile.role) ||
    !profile.tenant_id
  ) {
    return new NextResponse("Non autorisé.", { status: 403 });
  }
  const tenantId = profile.tenant_id;

  const formatDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("fr-FR") : "");

  // Tout est deja isole par tenant via RLS (le client garde la session de
  // l'appelant) -- pas de filtre .eq("tenant_id", ...) redondant sur les
  // tables qui n'ont pas tenant_id en colonne directe (lecons, soumissions...).
  const [
    { data: users },
    { data: courses },
    { data: enrollments },
    { data: progress },
    { data: assignments },
    { data: submissions },
    { data: liveSessions },
    { data: attendance },
    { data: insertions },
    { data: offres },
  ] = await Promise.all([
    supabase.from("users").select("id, nom, email, telephone, role, actif").eq("tenant_id", tenantId),
    supabase.from("courses").select("id, titre, filiere, modules(id, titre, lessons(id, titre, type, ordre))").eq("tenant_id", tenantId),
    supabase.from("enrollments").select("user_id, course_id, date_inscription").eq("tenant_id", tenantId),
    supabase.from("progress").select("user_id, lesson_id, statut, score, updated_at"),
    supabase.from("assignments").select("id, lesson_id, titre, date_limite"),
    supabase.from("submissions").select("assignment_id, user_id, note, submitted_at"),
    supabase.from("live_sessions").select("id, course_id, date_heure"),
    supabase.from("attendance").select("live_session_id, user_id, statut"),
    supabase.from("insertions_professionnelles").select("user_id, course_id, statut, entreprise, poste").eq("tenant_id", tenantId),
    supabase.from("offres_emploi").select("titre, entreprise, type, filiere, localisation, statut, created_at").eq("tenant_id", tenantId),
  ]);

  const nomById = new Map((users ?? []).map((u) => [u.id, u.nom]));
  const courseTitreById = new Map((courses ?? []).map((c) => [c.id, c.titre]));
  const lessonTitreById = new Map<string, string>();
  const lessonsByCourse = new Map<string, { id: string; titre: string; type: string; ordre: number; moduleTitre: string }[]>();
  for (const c of courses ?? []) {
    const lessons: { id: string; titre: string; type: string; ordre: number; moduleTitre: string }[] = [];
    for (const m of (c.modules ?? []) as { titre: string; lessons: { id: string; titre: string; type: string; ordre: number }[] | null }[]) {
      for (const l of m.lessons ?? []) {
        lessonTitreById.set(l.id, l.titre);
        lessons.push({ ...l, moduleTitre: m.titre });
      }
    }
    lessonsByCourse.set(c.id, lessons);
  }
  const assignmentTitreById = new Map((assignments ?? []).map((a) => [a.id, a.titre]));
  const sessionDateById = new Map((liveSessions ?? []).map((s) => [s.id, s.date_heure]));

  const zip = new JSZip();

  zip.file(
    "comptes.csv",
    toCsv(
      ["ID", "Nom", "Email", "Téléphone", "Rôle", "Actif"],
      (users ?? []).map((u) => [u.id, u.nom, u.email, u.telephone, u.role, u.actif ? "oui" : "non"]),
    ),
  );

  zip.file(
    "cours_et_lecons.csv",
    toCsv(
      ["Cours", "Filière", "Module", "Leçon", "Type", "Ordre"],
      (courses ?? []).flatMap((c) =>
        (lessonsByCourse.get(c.id) ?? []).map((l) => [c.titre, c.filiere, l.moduleTitre, l.titre, l.type, l.ordre]),
      ),
    ),
  );

  zip.file(
    "inscriptions.csv",
    toCsv(
      ["Élève", "Cours", "Date d'inscription"],
      (enrollments ?? []).map((e) => [nomById.get(e.user_id), courseTitreById.get(e.course_id), formatDate(e.date_inscription)]),
    ),
  );

  zip.file(
    "progression.csv",
    toCsv(
      ["Élève", "Leçon", "Statut", "Score", "Date"],
      (progress ?? [])
        .filter((p) => lessonTitreById.has(p.lesson_id))
        .map((p) => [nomById.get(p.user_id), lessonTitreById.get(p.lesson_id), p.statut, p.score ?? "", formatDate(p.updated_at)]),
    ),
  );

  zip.file(
    "devoirs_et_notes.csv",
    toCsv(
      ["Devoir", "Élève", "Note", "Date de soumission"],
      (submissions ?? [])
        .filter((s) => assignmentTitreById.has(s.assignment_id))
        .map((s) => [assignmentTitreById.get(s.assignment_id), nomById.get(s.user_id), s.note ?? "", formatDate(s.submitted_at)]),
    ),
  );

  zip.file(
    "presences.csv",
    toCsv(
      ["Élève", "Date de séance", "Statut"],
      (attendance ?? [])
        .filter((a) => sessionDateById.has(a.live_session_id))
        .map((a) => [nomById.get(a.user_id), formatDate(sessionDateById.get(a.live_session_id)), a.statut]),
    ),
  );

  zip.file(
    "insertion_professionnelle.csv",
    toCsv(
      ["Élève", "Cours", "Statut", "Entreprise", "Poste"],
      (insertions ?? []).map((i) => [nomById.get(i.user_id), courseTitreById.get(i.course_id), i.statut, i.entreprise, i.poste]),
    ),
  );

  zip.file(
    "offres_stages_emplois.csv",
    toCsv(
      ["Titre", "Entreprise", "Type", "Filière", "Localisation", "Statut", "Date de publication"],
      (offres ?? []).map((o) => [o.titre, o.entreprise, o.type, o.filiere, o.localisation, o.statut, formatDate(o.created_at)]),
    ),
  );

  const archive = await zip.generateAsync({ type: "arraybuffer" });

  return new NextResponse(archive, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="atlaslab-export.zip"',
    },
  });
}
