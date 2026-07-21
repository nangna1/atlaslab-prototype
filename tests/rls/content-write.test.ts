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

// Regression test pour le bug reel corrige par 20260717070000 : "un
// apprenant inscrit (ou n'importe quel autre role) pouvait modifier/
// supprimer le contenu pedagogique via l'API directe." Ecriture
// (insert/update/delete) sur courses/modules/lessons desormais reservee a
// professeur/admin_tenant/super_admin.
describe("Ecriture du contenu pédagogique réservée au staff", () => {
  const admin = adminClient();
  const state = newState();

  let tenant: TestTenant;
  let apprenant: TestUser;
  let professeur: TestUser;
  let course: { id: string };
  let moduleRow: { id: string };

  beforeAll(async () => {
    tenant = await createTestTenant(admin, state, "content");
    apprenant = await createTestUser(admin, state, { tenantId: tenant.id, role: "apprenant" });
    professeur = await createTestUser(admin, state, { tenantId: tenant.id, role: "professeur" });

    const { data: c, error: cErr } = await admin
      .from("courses")
      .insert({ tenant_id: tenant.id, titre: "Cours de base", professeur_id: professeur.id })
      .select("id")
      .single();
    if (cErr) throw cErr;
    course = c;

    const { data: m, error: mErr } = await admin
      .from("modules")
      .insert({ course_id: course.id, titre: "Module 1", ordre: 1 })
      .select("id")
      .single();
    if (mErr) throw mErr;
    moduleRow = m;
  });

  afterAll(async () => {
    await cleanupAll(admin, state);
  });

  it("un apprenant ne peut pas créer un cours", async () => {
    const { error } = await apprenant.client
      .from("courses")
      .insert({ tenant_id: tenant.id, titre: "Cours pirate" });
    expect(error).not.toBeNull();
  });

  it("un apprenant ne peut pas modifier un cours existant de son propre tenant", async () => {
    await apprenant.client.from("courses").update({ titre: "Modifié" }).eq("id", course.id);
    const { data } = await admin.from("courses").select("titre").eq("id", course.id).single();
    expect(data?.titre).toBe("Cours de base");
  });

  it("un apprenant ne peut pas créer de module ni de leçon", async () => {
    const { error: modErr } = await apprenant.client
      .from("modules")
      .insert({ course_id: course.id, titre: "Module pirate", ordre: 2 });
    expect(modErr).not.toBeNull();

    const { error: lecErr } = await apprenant.client
      .from("lessons")
      .insert({ module_id: moduleRow.id, titre: "Leçon pirate", ordre: 1, type: "contenu" });
    expect(lecErr).not.toBeNull();
  });

  it("un professeur peut créer/modifier/supprimer le contenu de son tenant", async () => {
    const { error: insErr, data: newModule } = await professeur.client
      .from("modules")
      .insert({ course_id: course.id, titre: "Module 2", ordre: 2 })
      .select("id")
      .single();
    expect(insErr).toBeNull();

    const { error: updErr } = await professeur.client
      .from("modules")
      .update({ titre: "Module 2 renommé" })
      .eq("id", newModule!.id);
    expect(updErr).toBeNull();

    const { error: delErr } = await professeur.client.from("modules").delete().eq("id", newModule!.id);
    expect(delErr).toBeNull();
  });
});

// Regression test pour 20260717040000 : un apprenant ne voit que les cours
// où il a une inscription (enrollments), pas tout le tenant comme les autres
// rôles.
describe("Vue apprenant restreinte aux cours inscrits", () => {
  const admin = adminClient();
  const state = newState();

  let tenant: TestTenant;
  let apprenant: TestUser;
  let professeur: TestUser;
  let coursInscrit: { id: string };
  let coursNonInscrit: { id: string };

  beforeAll(async () => {
    tenant = await createTestTenant(admin, state, "enrolledview");
    apprenant = await createTestUser(admin, state, { tenantId: tenant.id, role: "apprenant" });
    professeur = await createTestUser(admin, state, { tenantId: tenant.id, role: "professeur" });

    const { data: c1 } = await admin
      .from("courses")
      .insert({ tenant_id: tenant.id, titre: "Cours inscrit", professeur_id: professeur.id })
      .select("id")
      .single();
    coursInscrit = c1!;

    const { data: c2 } = await admin
      .from("courses")
      .insert({ tenant_id: tenant.id, titre: "Cours non inscrit", professeur_id: professeur.id })
      .select("id")
      .single();
    coursNonInscrit = c2!;

    await admin.from("enrollments").insert({
      tenant_id: tenant.id,
      user_id: apprenant.id,
      course_id: coursInscrit.id,
    });
  });

  afterAll(async () => {
    await cleanupAll(admin, state);
  });

  it("l'apprenant voit le cours où il est inscrit", async () => {
    const { data } = await apprenant.client.from("courses").select("id").eq("id", coursInscrit.id);
    expect(data).toHaveLength(1);
  });

  it("l'apprenant ne voit PAS un autre cours du même tenant où il n'est pas inscrit", async () => {
    const { data } = await apprenant.client.from("courses").select("id").eq("id", coursNonInscrit.id);
    expect(data).toEqual([]);
  });

  it("le professeur voit les deux cours du tenant, inscription ou non", async () => {
    const { data } = await professeur.client
      .from("courses")
      .select("id")
      .eq("tenant_id", tenant.id)
      .order("titre");
    expect(data?.map((c) => c.id).sort()).toEqual([coursInscrit.id, coursNonInscrit.id].sort());
  });
});
