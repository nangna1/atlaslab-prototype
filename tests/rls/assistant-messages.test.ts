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

// Historique de l'assistant IA (assistant_messages, 20260809000000) :
// strictement personnel -- contrairement a `messages` (staff <-> eleve), ici
// personne d'autre que l'auteur ne doit jamais voir ses messages, meme au
// sein du meme tenant/etablissement.
describe("Historique assistant IA (assistant_messages)", () => {
  const admin = adminClient();
  const state = newState();

  let tenant: TestTenant;
  let eleveA: TestUser;
  let eleveB: TestUser;
  let superAdmin: TestUser;

  beforeAll(async () => {
    tenant = await createTestTenant(admin, state, "assistant");
    eleveA = await createTestUser(admin, state, { tenantId: tenant.id, role: "apprenant" });
    eleveB = await createTestUser(admin, state, { tenantId: tenant.id, role: "apprenant" });
    // tenant_id NULL comme un vrai super_admin -- regression test pour le
    // meme piege "NULL = NULL n'est jamais vrai en SQL" que
    // tests/rls/super-admin.test.ts (voir le commentaire dans la migration).
    superAdmin = await createTestUser(admin, state, { tenantId: null, role: "super_admin" });
  });

  afterAll(async () => {
    await cleanupAll(admin, state);
  });

  it("un eleve peut écrire ses propres messages", async () => {
    const { error } = await eleveA.client
      .from("assistant_messages")
      .insert({ tenant_id: tenant.id, user_id: eleveA.id, role: "user", content: "Comment lancer le labo ?" });
    expect(error).toBeNull();
  });

  it("un eleve peut lire ses propres messages", async () => {
    const { data, error } = await eleveA.client
      .from("assistant_messages")
      .select("content")
      .eq("user_id", eleveA.id);
    expect(error).toBeNull();
    expect(data?.some((m) => m.content === "Comment lancer le labo ?")).toBe(true);
  });

  it("un eleve NE peut PAS lire les messages d'un autre eleve du même tenant", async () => {
    const { data, error } = await eleveB.client
      .from("assistant_messages")
      .select("content")
      .eq("user_id", eleveA.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("un eleve NE peut PAS écrire un message au nom d'un autre utilisateur", async () => {
    const { error } = await eleveB.client
      .from("assistant_messages")
      .insert({ tenant_id: tenant.id, user_id: eleveA.id, role: "user", content: "usurpation" });
    expect(error).not.toBeNull();
  });

  it("un eleve NE peut PAS écrire avec le tenant_id d'un autre établissement", async () => {
    const autreTenant = await createTestTenant(admin, state, "assistant-autre");
    const { error } = await eleveA.client
      .from("assistant_messages")
      .insert({ tenant_id: autreTenant.id, user_id: eleveA.id, role: "user", content: "faux tenant" });
    expect(error).not.toBeNull();
  });

  it("un eleve peut effacer ses propres messages", async () => {
    await eleveA.client
      .from("assistant_messages")
      .insert({ tenant_id: tenant.id, user_id: eleveA.id, role: "assistant", content: "a effacer" });
    const { error } = await eleveA.client.from("assistant_messages").delete().eq("user_id", eleveA.id);
    expect(error).toBeNull();
    const { data } = await eleveA.client.from("assistant_messages").select("id").eq("user_id", eleveA.id);
    expect(data).toEqual([]);
  });

  it("un eleve NE peut PAS effacer les messages d'un autre eleve", async () => {
    await eleveA.client
      .from("assistant_messages")
      .insert({ tenant_id: tenant.id, user_id: eleveA.id, role: "user", content: "protege" });
    await eleveB.client.from("assistant_messages").delete().eq("user_id", eleveA.id);
    const { data } = await eleveA.client.from("assistant_messages").select("id").eq("user_id", eleveA.id);
    expect(data?.length).toBe(1);
  });

  it("un super_admin (tenant_id NULL) peut écrire et lire ses propres messages", async () => {
    const { error: insertErr } = await superAdmin.client
      .from("assistant_messages")
      .insert({ tenant_id: null, user_id: superAdmin.id, role: "user", content: "question super admin" });
    expect(insertErr).toBeNull();

    const { data, error: selectErr } = await superAdmin.client
      .from("assistant_messages")
      .select("content")
      .eq("user_id", superAdmin.id);
    expect(selectErr).toBeNull();
    expect(data?.some((m) => m.content === "question super admin")).toBe(true);
  });
});
