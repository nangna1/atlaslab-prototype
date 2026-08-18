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
import { getCoursEnseignes, getProfDashboardStats, getDevoirsACorriger } from "../../lib/professeur-dashboard-data";

// lib/professeur-dashboard-data.ts (2026-08-11, "un tableau de bord adapte a
// chaque utilisateur") : 0 test jusqu'ici.
//
// Point d'attention particulier verifie ici : la RLS de lecture sur
// courses/lessons/assignments/submissions est scopee par TENANT, pas par
// professeur_id (voir 20260717070000_content_write_restricted_to_staff.sql,
// lessons_select/courses_select) - un professeur peut donc lire en base les
// cours de ses collegues du meme etablissement. L'isolation "un professeur
// ne voit QUE ses propres eleves/devoirs" sur ce tableau de bord repose
// entierement sur le filtrage cote application (coursIds issus de
// getCoursEnseignes, filtre .eq("professeur_id", ...)), PAS sur une policy
// RLS dediee. Si ce filtrage disparaissait par erreur dans un futur
// refactor, RLS seule ne le rattraperait pas -- d'ou l'interet reel de ce
// test, au-dela d'une simple mesure de couverture.
describe("Tableau de bord professeur : lib/professeur-dashboard-data.ts", () => {
  const admin = adminClient();
  const state = newState();

  let tenant: TestTenant;
  let profA: TestUser;
  let profB: TestUser;
  let eleveA: TestUser;
  let eleveB: TestUser;
  let courseAId: string;
  let lessonAId: string;

  beforeAll(async () => {
    tenant = await createTestTenant(admin, state, "prof_dash");
    profA = await createTestUser(admin, state, { tenantId: tenant.id, role: "professeur", nom: "Prof A" });
    profB = await createTestUser(admin, state, { tenantId: tenant.id, role: "professeur", nom: "Prof B" });
    eleveA = await createTestUser(admin, state, { tenantId: tenant.id, role: "apprenant" });
    eleveB = await createTestUser(admin, state, { tenantId: tenant.id, role: "apprenant" });

    const { data: courses } = await admin
      .from("courses")
      .insert([
        { tenant_id: tenant.id, titre: "Cours de Prof A", professeur_id: profA.id },
        { tenant_id: tenant.id, titre: "Cours de Prof B", professeur_id: profB.id },
      ])
      .select("id, titre, professeur_id");
    courseAId = courses!.find((c) => c.professeur_id === profA.id)!.id;
    const courseBId = courses!.find((c) => c.professeur_id === profB.id)!.id;

    const { data: modules } = await admin
      .from("modules")
      .insert([
        { course_id: courseAId, titre: "Module A", ordre: 1 },
        { course_id: courseBId, titre: "Module B", ordre: 1 },
      ])
      .select("id, course_id");
    const moduleAId = modules!.find((m) => m.course_id === courseAId)!.id;
    const moduleBId = modules!.find((m) => m.course_id === courseBId)!.id;

    const { data: lessons } = await admin
      .from("lessons")
      .insert([
        { module_id: moduleAId, titre: "Leçon A", ordre: 1, type: "contenu" },
        { module_id: moduleBId, titre: "Leçon B", ordre: 1, type: "contenu" },
      ])
      .select("id, module_id");
    lessonAId = lessons!.find((l) => l.module_id === moduleAId)!.id;
    const lessonBId = lessons!.find((l) => l.module_id === moduleBId)!.id;

    await admin.from("enrollments").insert([
      { tenant_id: tenant.id, user_id: eleveA.id, course_id: courseAId },
      { tenant_id: tenant.id, user_id: eleveB.id, course_id: courseBId },
    ]);

    // Moitié de la leçon de A terminée (1 élève, 1 leçon -> 100% une fois
    // marquée) et un devoir en attente de correction sur chaque cours.
    await admin.from("progress").insert({ user_id: eleveA.id, lesson_id: lessonAId, statut: "termine" });

    const { data: assignments } = await admin
      .from("assignments")
      .insert([
        { lesson_id: lessonAId, titre: "Devoir cours A" },
        { lesson_id: lessonBId, titre: "Devoir cours B" },
      ])
      .select("id, titre");
    const assignmentAId = assignments!.find((a) => a.titre === "Devoir cours A")!.id;
    const assignmentBId = assignments!.find((a) => a.titre === "Devoir cours B")!.id;

    await admin.from("submissions").insert([
      { assignment_id: assignmentAId, user_id: eleveA.id, contenu: "rendu par élève A" },
      { assignment_id: assignmentBId, user_id: eleveB.id, contenu: "rendu par élève B" },
    ]);
  });

  afterAll(async () => {
    await cleanupAll(admin, state);
  });

  it("getCoursEnseignes ne retourne que les cours du professeur appelant, avec sa progression moyenne", async () => {
    const coursA = await getCoursEnseignes(profA.client, profA.id);
    expect(coursA).toHaveLength(1);
    expect(coursA[0].titre).toBe("Cours de Prof A");
    expect(coursA[0].totalEleves).toBe(1);
    expect(coursA[0].progressionMoyenne).toBe(100);

    const coursB = await getCoursEnseignes(profB.client, profB.id);
    expect(coursB).toHaveLength(1);
    expect(coursB[0].titre).toBe("Cours de Prof B");
    expect(coursB[0].progressionMoyenne).toBe(0);
  });

  it("getProfDashboardStats isole les élèves et devoirs à corriger par professeur, malgré une RLS de lecture tenant-large", async () => {
    const coursA = await getCoursEnseignes(profA.client, profA.id);
    const statsA = await getProfDashboardStats(profA.client, profA.id, coursA);
    expect(statsA.coursCount).toBe(1);
    expect(statsA.elevesCount).toBe(1);
    expect(statsA.devoirsACorrigerCount).toBe(1);

    const coursB = await getCoursEnseignes(profB.client, profB.id);
    const statsB = await getProfDashboardStats(profB.client, profB.id, coursB);
    expect(statsB.elevesCount).toBe(1);
    expect(statsB.devoirsACorrigerCount).toBe(1);
  });

  it("getDevoirsACorriger de Prof A ne contient jamais un devoir/élève de Prof B", async () => {
    const coursA = await getCoursEnseignes(profA.client, profA.id);
    const devoirsA = await getDevoirsACorriger(profA.client, profA.id, coursA);
    expect(devoirsA).toHaveLength(1);
    expect(devoirsA[0].assignmentTitre).toBe("Devoir cours A");
    expect(devoirsA[0].courseTitre).toBe("Cours de Prof A");
    expect(devoirsA.some((d) => d.assignmentTitre === "Devoir cours B")).toBe(false);
  });
});
