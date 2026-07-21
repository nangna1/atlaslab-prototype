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

// Regression test pour le bug reel documente dans 20260717070000 : "un
// apprenant peut s'auto-inscrire a n'importe quel cours de son tenant en
// appelant l'API Supabase directement (insert dans enrollments), ce qui
// contourne entierement la restriction RLS 'vue apprenant'." Ecriture sur
// enrollments desormais reservee a professeur/admin_tenant/super_admin.
describe("Auto-inscription apprenant bloquée (enrollments)", () => {
  const admin = adminClient();
  const state = newState();

  let tenant: TestTenant;
  let apprenant: TestUser;
  let professeur: TestUser;
  let course: { id: string };

  beforeAll(async () => {
    tenant = await createTestTenant(admin, state, "enroll");
    apprenant = await createTestUser(admin, state, { tenantId: tenant.id, role: "apprenant" });
    professeur = await createTestUser(admin, state, { tenantId: tenant.id, role: "professeur" });

    const { data } = await admin
      .from("courses")
      .insert({ tenant_id: tenant.id, titre: "Cours convoité", professeur_id: professeur.id })
      .select("id")
      .single();
    course = data!;
  });

  afterAll(async () => {
    await cleanupAll(admin, state);
  });

  it("un apprenant ne peut pas s'auto-inscrire à un cours via l'API directe", async () => {
    const { error } = await apprenant.client
      .from("enrollments")
      .insert({ tenant_id: tenant.id, user_id: apprenant.id, course_id: course.id });
    expect(error).not.toBeNull();

    const { data: verif } = await admin
      .from("enrollments")
      .select("id")
      .eq("user_id", apprenant.id)
      .eq("course_id", course.id);
    expect(verif).toEqual([]);
  });

  it("un professeur peut inscrire un apprenant à un cours", async () => {
    const { error } = await professeur.client
      .from("enrollments")
      .insert({ tenant_id: tenant.id, user_id: apprenant.id, course_id: course.id });
    expect(error).toBeNull();

    const { data: verif } = await admin
      .from("enrollments")
      .select("id")
      .eq("user_id", apprenant.id)
      .eq("course_id", course.id);
    expect(verif).toHaveLength(1);
  });
});
