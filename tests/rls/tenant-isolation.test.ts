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

// Isolation stricte par tenant (20260717000000_init.sql : "tenant_id =
// (auth.jwt() ->> 'tenant_id')::uuid" sur courses/users/enrollments, cascade
// via jointure pour modules/lessons) : un utilisateur d'un tenant ne doit
// jamais voir, modifier, ni supprimer une ligne d'un AUTRE tenant, meme en
// appelant l'API Supabase directement (anon key + son propre JWT), pas
// seulement via l'UI.
describe("Isolation multi-tenant (courses/users)", () => {
  const admin = adminClient();
  const state = newState();

  let tenantA: TestTenant;
  let tenantB: TestTenant;
  let profA: TestUser;
  let profB: TestUser;
  let courseB: { id: string };

  beforeAll(async () => {
    tenantA = await createTestTenant(admin, state, "tenantA");
    tenantB = await createTestTenant(admin, state, "tenantB");
    profA = await createTestUser(admin, state, { tenantId: tenantA.id, role: "professeur" });
    profB = await createTestUser(admin, state, { tenantId: tenantB.id, role: "professeur" });

    const { data, error } = await admin
      .from("courses")
      .insert({ tenant_id: tenantB.id, titre: "Cours prive tenant B", professeur_id: profB.id })
      .select("id")
      .single();
    if (error) throw error;
    courseB = data;
  });

  afterAll(async () => {
    await cleanupAll(admin, state);
  });

  it("un professeur du tenant A ne voit aucun cours du tenant B", async () => {
    const { data, error } = await profA.client.from("courses").select("id").eq("tenant_id", tenantB.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("un professeur du tenant A ne peut pas modifier un cours du tenant B", async () => {
    const { data, error } = await profA.client
      .from("courses")
      .update({ titre: "Piraté" })
      .eq("id", courseB.id)
      .select();
    // RLS bloque silencieusement (0 ligne affectee), pas forcement une erreur explicite.
    expect(data ?? []).toEqual([]);
    void error;

    const { data: verif } = await admin.from("courses").select("titre").eq("id", courseB.id).single();
    expect(verif?.titre).toBe("Cours prive tenant B");
  });

  it("un professeur du tenant A ne peut pas supprimer un cours du tenant B", async () => {
    await profA.client.from("courses").delete().eq("id", courseB.id);
    const { data: verif } = await admin.from("courses").select("id").eq("id", courseB.id).single();
    expect(verif?.id).toBe(courseB.id);
  });

  it("un professeur du tenant A ne voit aucun membre public.users du tenant B", async () => {
    const { data, error } = await profA.client.from("users").select("id").eq("tenant_id", tenantB.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("un professeur voit bien les membres de SON tenant", async () => {
    const { data, error } = await profA.client.from("users").select("id").eq("tenant_id", tenantA.id);
    expect(error).toBeNull();
    expect(data?.map((u) => u.id)).toContain(profA.id);
  });
});
