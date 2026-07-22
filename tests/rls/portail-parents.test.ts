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

// Portail parents : role 'parent' strictement lecture seule, scope via la
// table parents_enfants (voir supabase/migrations/20260802000000_portail_parents.sql).
// Toutes les nouvelles policies sont additives (for select uniquement) --
// jamais d'insert/update/delete pour ce role, verifie explicitement ci-dessous.
describe("Lien parents_enfants : creation/suppression reservee a admin_tenant/super_admin", () => {
  const admin = adminClient();
  const state = newState();

  let tenant: TestTenant;
  let adminTenant: TestUser;
  let parent: TestUser;
  let enfant: TestUser;

  beforeAll(async () => {
    tenant = await createTestTenant(admin, state, "liensparent");
    adminTenant = await createTestUser(admin, state, { tenantId: tenant.id, role: "admin_tenant" });
    parent = await createTestUser(admin, state, { tenantId: tenant.id, role: "parent" });
    enfant = await createTestUser(admin, state, { tenantId: tenant.id, role: "apprenant" });
  });

  afterAll(async () => {
    await cleanupAll(admin, state);
  });

  it("admin_tenant peut créer un lien parent-enfant", async () => {
    const { error } = await adminTenant.client
      .from("parents_enfants")
      .insert({ tenant_id: tenant.id, parent_id: parent.id, enfant_id: enfant.id });
    expect(error).toBeNull();
  });

  it("un parent ne peut pas se lier lui-même à un élève", async () => {
    const autreEnfant = await createTestUser(admin, state, { tenantId: tenant.id, role: "apprenant" });
    const { error } = await parent.client
      .from("parents_enfants")
      .insert({ tenant_id: tenant.id, parent_id: parent.id, enfant_id: autreEnfant.id });
    expect(error).not.toBeNull();
  });

  it("l'insertion échoue si enfant_id n'a pas le rôle apprenant", async () => {
    const autreParent = await createTestUser(admin, state, { tenantId: tenant.id, role: "parent" });
    const { error } = await adminTenant.client
      .from("parents_enfants")
      .insert({ tenant_id: tenant.id, parent_id: parent.id, enfant_id: autreParent.id });
    expect(error).not.toBeNull();
  });
});

describe("Isolation multi-tenant du lien parents_enfants", () => {
  const admin = adminClient();
  const state = newState();

  let tenantA: TestTenant;
  let tenantB: TestTenant;
  let adminA: TestUser;
  let parentA: TestUser;
  let enfantB: TestUser;

  beforeAll(async () => {
    tenantA = await createTestTenant(admin, state, "liensA");
    tenantB = await createTestTenant(admin, state, "liensB");
    adminA = await createTestUser(admin, state, { tenantId: tenantA.id, role: "admin_tenant" });
    parentA = await createTestUser(admin, state, { tenantId: tenantA.id, role: "parent" });
    enfantB = await createTestUser(admin, state, { tenantId: tenantB.id, role: "apprenant" });
  });

  afterAll(async () => {
    await cleanupAll(admin, state);
  });

  it("un admin ne peut pas lier son parent à un élève d'un AUTRE tenant", async () => {
    const { error } = await adminA.client
      .from("parents_enfants")
      .insert({ tenant_id: tenantA.id, parent_id: parentA.id, enfant_id: enfantB.id });
    expect(error).not.toBeNull();
  });
});

describe("Portail parents : accès en lecture seule scopé à l'enfant lié", () => {
  const admin = adminClient();
  const state = newState();

  let tenant: TestTenant;
  let professeur: TestUser;
  let parent: TestUser;
  let enfant: TestUser;
  let autreEleve: TestUser;
  let course: { id: string };
  let lesson: { id: string };
  let assignment: { id: string };

  beforeAll(async () => {
    tenant = await createTestTenant(admin, state, "portailparent");
    professeur = await createTestUser(admin, state, { tenantId: tenant.id, role: "professeur" });
    parent = await createTestUser(admin, state, { tenantId: tenant.id, role: "parent" });
    enfant = await createTestUser(admin, state, { tenantId: tenant.id, role: "apprenant" });
    autreEleve = await createTestUser(admin, state, { tenantId: tenant.id, role: "apprenant" });

    await admin.from("parents_enfants").insert({ tenant_id: tenant.id, parent_id: parent.id, enfant_id: enfant.id });

    const { data: c } = await admin
      .from("courses")
      .insert({ tenant_id: tenant.id, titre: "Cours portail parent", professeur_id: professeur.id })
      .select("id")
      .single();
    course = c!;
    const { data: m } = await admin
      .from("modules")
      .insert({ course_id: course.id, titre: "Module", ordre: 1 })
      .select("id")
      .single();
    const { data: l } = await admin
      .from("lessons")
      .insert({ module_id: m!.id, titre: "Leçon", ordre: 1, type: "contenu" })
      .select("id")
      .single();
    lesson = l!;
    const { data: a } = await admin
      .from("assignments")
      .insert({ lesson_id: lesson.id, titre: "Devoir" })
      .select("id")
      .single();
    assignment = a!;

    // Inscription + progression + note + absence pour l'enfant lié
    await admin.from("enrollments").insert({ tenant_id: tenant.id, user_id: enfant.id, course_id: course.id });
    await admin.from("progress").insert({ user_id: enfant.id, lesson_id: lesson.id, statut: "termine", score: 15 });
    await admin.from("submissions").insert({ assignment_id: assignment.id, user_id: enfant.id, note: 14 });

    const { data: session } = await admin
      .from("live_sessions")
      .insert({ course_id: course.id, date_heure: new Date().toISOString(), professeur_id: professeur.id })
      .select("id")
      .single();
    await admin.from("attendance").insert({ live_session_id: session!.id, user_id: enfant.id, statut: "absent" });

    // Meme dispositif pour un AUTRE eleve non lie au parent, pour verifier l'exclusion
    await admin.from("enrollments").insert({ tenant_id: tenant.id, user_id: autreEleve.id, course_id: course.id });
    await admin.from("progress").insert({ user_id: autreEleve.id, lesson_id: lesson.id, statut: "termine", score: 5 });
  });

  afterAll(async () => {
    await cleanupAll(admin, state);
  });

  it("le parent voit le cours où son enfant est inscrit", async () => {
    const { data, error } = await parent.client.from("courses").select("id").eq("id", course.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("le parent voit la progression de son enfant", async () => {
    const { data, error } = await parent.client.from("progress").select("statut").eq("user_id", enfant.id);
    expect(error).toBeNull();
    expect(data?.[0]?.statut).toBe("termine");
  });

  it("le parent voit la note du devoir de son enfant", async () => {
    const { data, error } = await parent.client.from("submissions").select("note").eq("user_id", enfant.id);
    expect(error).toBeNull();
    expect(data?.[0]?.note).toBe(14);
  });

  it("le parent voit l'absence de son enfant", async () => {
    const { data, error } = await parent.client.from("attendance").select("statut").eq("user_id", enfant.id);
    expect(error).toBeNull();
    expect(data?.[0]?.statut).toBe("absent");
  });

  it("le parent ne voit PAS la progression d'un autre élève du même tenant", async () => {
    const { data, error } = await parent.client.from("progress").select("id").eq("user_id", autreEleve.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("le parent ne peut rien écrire (ex: modifier la progression de son enfant)", async () => {
    await parent.client.from("progress").update({ statut: "non_commence" }).eq("user_id", enfant.id);
    const { data } = await admin.from("progress").select("statut").eq("user_id", enfant.id).single();
    expect(data?.statut).toBe("termine");
  });

  it("le parent ne peut pas insérer de nouvelle progression pour son enfant", async () => {
    const { error } = await parent.client
      .from("progress")
      .insert({ user_id: enfant.id, lesson_id: lesson.id, statut: "en_cours" });
    expect(error).not.toBeNull();
  });
});
