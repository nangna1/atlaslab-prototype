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

// Regression test pour le bug reel corrige par 20260717050000 : "n'importe
// quel membre du tenant (y compris un apprenant) pouvait insérer ou modifier
// n'importe quelle ligne public.users de son tenant via l'API Supabase
// directe [...] y compris s'auto-élever admin_tenant/super_admin en
// changeant sa propre colonne 'role'." La lecture reste ouverte a tout le
// tenant ; seule l'ecriture (insert/update/delete) est ici reservee a
// admin_tenant/super_admin (ou, pour les apprenants, a un professeur
// moderateur -- voir 20260731000000_moderateurs.sql).
describe("Ecriture sur public.users reservee a l'admin (anti auto-elevation)", () => {
  const admin = adminClient();
  const state = newState();

  let tenant: TestTenant;
  let apprenant: TestUser;
  let professeur: TestUser;
  let adminTenant: TestUser;

  beforeAll(async () => {
    tenant = await createTestTenant(admin, state, "userswrite");
    apprenant = await createTestUser(admin, state, { tenantId: tenant.id, role: "apprenant" });
    professeur = await createTestUser(admin, state, { tenantId: tenant.id, role: "professeur" });
    adminTenant = await createTestUser(admin, state, { tenantId: tenant.id, role: "admin_tenant" });
  });

  afterAll(async () => {
    await cleanupAll(admin, state);
  });

  it("un apprenant ne peut pas s'auto-élever admin_tenant", async () => {
    await apprenant.client.from("users").update({ role: "admin_tenant" }).eq("id", apprenant.id);
    const { data } = await admin.from("users").select("role").eq("id", apprenant.id).single();
    expect(data?.role).toBe("apprenant");
  });

  it("un professeur (non modérateur) ne peut pas modifier un autre membre du tenant", async () => {
    await professeur.client.from("users").update({ nom: "Modifié" }).eq("id", apprenant.id);
    const { data } = await admin.from("users").select("nom").eq("id", apprenant.id).single();
    expect(data?.nom).not.toBe("Modifié");
  });

  it("un apprenant ne peut pas insérer un nouveau compte dans son tenant", async () => {
    const { error } = await apprenant.client
      .from("users")
      .insert({ id: crypto.randomUUID(), tenant_id: tenant.id, role: "apprenant", nom: "Intrus" });
    expect(error).not.toBeNull();
  });

  it("admin_tenant peut modifier un membre de son tenant", async () => {
    const { error } = await adminTenant.client
      .from("users")
      .update({ nom: "Renommé par admin" })
      .eq("id", apprenant.id);
    expect(error).toBeNull();
    const { data } = await admin.from("users").select("nom").eq("id", apprenant.id).single();
    expect(data?.nom).toBe("Renommé par admin");
  });
});

describe("Portée du statut modérateur (professeur habilité)", () => {
  const admin = adminClient();
  const state = newState();

  let tenant: TestTenant;
  let apprenant: TestUser;
  let autreProfesseur: TestUser;
  let moderateur: TestUser;

  beforeAll(async () => {
    tenant = await createTestTenant(admin, state, "moderateur");
    apprenant = await createTestUser(admin, state, { tenantId: tenant.id, role: "apprenant" });
    autreProfesseur = await createTestUser(admin, state, { tenantId: tenant.id, role: "professeur" });
    moderateur = await createTestUser(admin, state, {
      tenantId: tenant.id,
      role: "professeur",
      estModerateur: true,
    });
  });

  afterAll(async () => {
    await cleanupAll(admin, state);
  });

  it("un professeur modérateur peut modifier un compte apprenant du même tenant", async () => {
    const { error } = await moderateur.client
      .from("users")
      .update({ nom: "Renommé par modérateur" })
      .eq("id", apprenant.id);
    expect(error).toBeNull();
    const { data } = await admin.from("users").select("nom").eq("id", apprenant.id).single();
    expect(data?.nom).toBe("Renommé par modérateur");
  });

  it("un professeur modérateur ne peut PAS modifier un compte professeur (hors périmètre apprenant)", async () => {
    await moderateur.client.from("users").update({ nom: "Piraté" }).eq("id", autreProfesseur.id);
    const { data } = await admin.from("users").select("nom").eq("id", autreProfesseur.id).single();
    expect(data?.nom).not.toBe("Piraté");
  });
});
