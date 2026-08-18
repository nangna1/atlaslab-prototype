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
import { getDashboardStats } from "../../lib/dashboard-data";

// lib/dashboard-data.ts alimente /admin/tableau-de-bord (recap eleves/profs
// du tenant appelant) : 0 test jusqu'ici. Contrairement au tableau de bord
// professeur (voir professeur-dashboard-data.test.ts), ici l'isolation
// repose bien sur des policies RLS explicitement scopees par tenant sur
// chaque table interrogee (users, progress, submissions, courses,
// live_sessions) - ce test verifie que cette isolation tient reellement de
// bout en bout sur le calcul agrege, pas seulement table par table.
describe("Tableau de bord établissement : lib/dashboard-data.ts", () => {
  const admin = adminClient();
  const state = newState();

  let tenantA: TestTenant;
  let tenantB: TestTenant;
  let adminA: TestUser;
  let profA: TestUser;
  let eleveA: TestUser;

  beforeAll(async () => {
    tenantA = await createTestTenant(admin, state, "dash_a");
    tenantB = await createTestTenant(admin, state, "dash_b");

    adminA = await createTestUser(admin, state, { tenantId: tenantA.id, role: "admin_tenant" });
    profA = await createTestUser(admin, state, { tenantId: tenantA.id, role: "professeur", nom: "Prof Tenant A" });
    eleveA = await createTestUser(admin, state, { tenantId: tenantA.id, role: "apprenant", nom: "Élève Tenant A" });

    const profB = await createTestUser(admin, state, { tenantId: tenantB.id, role: "professeur", nom: "Prof Tenant B" });
    const eleveB = await createTestUser(admin, state, { tenantId: tenantB.id, role: "apprenant", nom: "Élève Tenant B" });

    const { data: courseA } = await admin
      .from("courses")
      .insert({ tenant_id: tenantA.id, titre: "Cours A", professeur_id: profA.id })
      .select("id")
      .single();
    const { data: courseB } = await admin
      .from("courses")
      .insert({ tenant_id: tenantB.id, titre: "Cours B", professeur_id: profB.id })
      .select("id")
      .single();

    const { data: moduleA } = await admin
      .from("modules")
      .insert({ course_id: courseA!.id, titre: "Module A", ordre: 1 })
      .select("id")
      .single();
    const { data: moduleB } = await admin
      .from("modules")
      .insert({ course_id: courseB!.id, titre: "Module B", ordre: 1 })
      .select("id")
      .single();

    const { data: lessonA } = await admin
      .from("lessons")
      .insert({ module_id: moduleA!.id, titre: "Leçon A", ordre: 1, type: "contenu" })
      .select("id")
      .single();
    const { data: lessonB } = await admin
      .from("lessons")
      .insert({ module_id: moduleB!.id, titre: "Leçon B", ordre: 1, type: "contenu" })
      .select("id")
      .single();

    await admin.from("progress").insert([
      { user_id: eleveA.id, lesson_id: lessonA!.id, statut: "termine" },
      { user_id: eleveB.id, lesson_id: lessonB!.id, statut: "termine" },
    ]);
  });

  afterAll(async () => {
    await cleanupAll(admin, state);
  });

  it("l'admin d'un établissement ne voit que les élèves/professeurs de son propre tenant", async () => {
    const { eleveStats, profStats } = await getDashboardStats(adminA.client);

    expect(eleveStats.map((e) => e.nom)).toEqual(["Élève Tenant A"]);
    expect(eleveStats[0].leconsTerminees).toBe(1);

    expect(profStats.map((p) => p.nom)).toEqual(["Prof Tenant A"]);
    expect(profStats[0].coursCrees).toBe(1);

    expect(eleveStats.some((e) => e.nom === "Élève Tenant B")).toBe(false);
    expect(profStats.some((p) => p.nom === "Prof Tenant B")).toBe(false);
  });
});
