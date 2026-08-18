import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  adminClient,
  newState,
  createTestTenant,
  createTestUser,
  cleanupAll,
  TestUser,
  TestTenant,
} from "../helpers/fixtures";
import {
  getLearnerCourses,
  getResumeTargetFromCourses,
  getLearnerStats,
  getWeekAgenda,
  getUpcomingAssignments,
} from "../../lib/learner-dashboard-data";

// lib/learner-dashboard-data.ts alimente le tableau de bord eleve sur /cours
// (redesign 2026-08-10) : jusqu'ici 0 test, alors que ces calculs (pourcentage
// de progression, prochaine lecon a reprendre, agenda de la semaine, devoirs
// en attente) sont directement affiches a l'utilisateur - une erreur ici ne
// casse rien techniquement (pas de policy RLS a proprement violer), elle
// affiche juste un mauvais chiffre a un eleve.
describe("Tableau de bord élève : lib/learner-dashboard-data.ts", () => {
  const admin = adminClient();
  const state = newState();

  let tenant: TestTenant;
  let professeur: TestUser;
  let apprenant: TestUser;
  let courseId: string;
  let lessonContenuId: string;
  let lessonLaboId: string;
  let lessonAvecDevoirId: string;
  let assignmentRenduId: string;
  let assignmentEnAttenteId: string;

  beforeAll(async () => {
    tenant = await createTestTenant(admin, state, "learner_dash");
    professeur = await createTestUser(admin, state, { tenantId: tenant.id, role: "professeur" });
    apprenant = await createTestUser(admin, state, { tenantId: tenant.id, role: "apprenant" });

    const { data: course } = await admin
      .from("courses")
      .insert({ tenant_id: tenant.id, titre: "Béton armé", filiere: "Génie civil", professeur_id: professeur.id })
      .select("id")
      .single();
    courseId = course!.id;

    const { data: moduleRow } = await admin
      .from("modules")
      .insert({ course_id: courseId, titre: "Module 1", ordre: 1 })
      .select("id")
      .single();
    const moduleId = moduleRow!.id;

    // 3 leçons : une "contenu" terminée, une "labo" terminée, une "contenu"
    // avec devoir non terminée -- volontairement pas dans l'ordre 1/2/3 pour
    // vérifier que la "prochaine leçon" respecte bien l'ordre déclaré (ordre),
    // pas l'ordre d'insertion.
    const { data: lessons } = await admin
      .from("lessons")
      .insert([
        { module_id: moduleId, titre: "Notions de base", ordre: 1, type: "contenu" },
        { module_id: moduleId, titre: "Labo dimensionnement", ordre: 2, type: "labo" },
        { module_id: moduleId, titre: "Devoir noté", ordre: 3, type: "contenu" },
      ])
      .select("id, titre, ordre");
    lessonContenuId = lessons!.find((l) => l.ordre === 1)!.id;
    lessonLaboId = lessons!.find((l) => l.ordre === 2)!.id;
    lessonAvecDevoirId = lessons!.find((l) => l.ordre === 3)!.id;

    await admin.from("enrollments").insert({ tenant_id: tenant.id, user_id: apprenant.id, course_id: courseId });

    // 2 leçons sur 3 terminées (contenu + labo) -> 67% attendu (Math.round(2/3*100)).
    await admin.from("progress").insert([
      { user_id: apprenant.id, lesson_id: lessonContenuId, statut: "termine" },
      { user_id: apprenant.id, lesson_id: lessonLaboId, statut: "termine" },
    ]);

    // 2 devoirs sur la 3e leçon : un déjà rendu, un encore en attente.
    const { data: assignments } = await admin
      .from("assignments")
      .insert([
        { lesson_id: lessonAvecDevoirId, titre: "Rendu déjà fait", date_limite: null },
        { lesson_id: lessonAvecDevoirId, titre: "Rendu en attente", date_limite: "2026-09-01T00:00:00Z" },
      ])
      .select("id, titre");
    assignmentRenduId = assignments!.find((a) => a.titre === "Rendu déjà fait")!.id;
    assignmentEnAttenteId = assignments!.find((a) => a.titre === "Rendu en attente")!.id;

    await admin.from("submissions").insert({ assignment_id: assignmentRenduId, user_id: apprenant.id, contenu: "fait" });

    // Séances : une cette semaine (mardi de la semaine courante), une hors
    // de la fenêtre "cette semaine" (bien après le lundi suivant) -- meme
    // calcul de lundi que getWeekAgenda pour ne jamais dependre du jour
    // d'execution du test.
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() + diffToMonday);
    const nextMonday = new Date(monday);
    nextMonday.setDate(monday.getDate() + 7);

    const dansLaSemaine = new Date(monday);
    dansLaSemaine.setDate(monday.getDate() + 1);
    dansLaSemaine.setHours(10, 0, 0, 0);

    const horsSemaine = new Date(nextMonday);
    horsSemaine.setDate(nextMonday.getDate() + 3);

    await admin.from("live_sessions").insert([
      { course_id: courseId, date_heure: dansLaSemaine.toISOString(), lien_visio: "https://meet.example/x", professeur_id: professeur.id },
      { course_id: courseId, date_heure: horsSemaine.toISOString(), professeur_id: professeur.id },
    ]);
  });

  afterAll(async () => {
    await cleanupAll(admin, state);
  });

  it("getLearnerCourses calcule le pourcentage de progression et la prochaine leçon dans l'ordre", async () => {
    const courses = await getLearnerCourses(apprenant.client, apprenant.id);
    expect(courses).toHaveLength(1);
    const c = courses[0];
    expect(c.totalLessons).toBe(3);
    expect(c.termine).toBe(2);
    expect(c.pct).toBe(67);
    expect(c.nextLessonId).toBe(lessonAvecDevoirId);
    expect(c.nextLessonTitre).toBe("Devoir noté");
  });

  it("getResumeTargetFromCourses pointe vers la prochaine leçon du cours en cours", async () => {
    const courses = await getLearnerCourses(apprenant.client, apprenant.id);
    const resume = getResumeTargetFromCourses(courses);
    expect(resume).toEqual({ courseId, lessonId: lessonAvecDevoirId, courseTitre: "Béton armé" });
  });

  it("getResumeTargetFromCourses renvoie null si tous les cours sont terminés", () => {
    const coursTermine = [
      {
        id: "x",
        titre: "Terminé",
        filiere: null,
        code: "TER",
        totalModules: 1,
        totalLessons: 1,
        termine: 1,
        pct: 100,
        nextLessonId: null,
        nextLessonTitre: null,
      },
    ];
    expect(getResumeTargetFromCourses(coursTermine)).toBeNull();
  });

  it("getLearnerStats compte devoirs rendus/total et labos terminés indépendamment de la progression globale", async () => {
    const courses = await getLearnerCourses(apprenant.client, apprenant.id);
    const stats = await getLearnerStats(apprenant.client, apprenant.id, courses);
    expect(stats.coursSuivisCount).toBe(1);
    expect(stats.progressionGlobalePct).toBe(67);
    expect(stats.devoirsRendus).toBe(1);
    expect(stats.devoirsTotal).toBe(2);
    expect(stats.labosTermines).toBe(1);
  });

  it("getWeekAgenda ne retourne que les séances de la semaine en cours (lundi-dimanche)", async () => {
    const agenda = await getWeekAgenda(apprenant.client, apprenant.id);
    expect(agenda).toHaveLength(1);
    expect(agenda[0].titre).toBe("Béton armé");
    expect(agenda[0].lieu).toBe("Visio");
  });

  it("getUpcomingAssignments exclut les devoirs déjà rendus", async () => {
    const devoirs = await getUpcomingAssignments(apprenant.client, apprenant.id);
    expect(devoirs.map((d) => d.id)).toEqual([assignmentEnAttenteId]);
    expect(devoirs[0].titre).toBe("Rendu en attente");
  });
});
