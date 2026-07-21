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

// Regression test pour le bug reel corrige par 20260717110000 : la policy de
// lecture users filtrait par "tenant_id = jwt tenant_id" -- pour un
// super_admin (tenant_id NULL en JWT et en base), NULL = NULL n'est jamais
// vrai en SQL, donc un super_admin ne pouvait meme pas lire SA PROPRE ligne
// public.users (le renvoyant vers /cours comme un non-authentifie). Meme
// logique testee sur tenants_select (20260717100000).
describe("Accès cross-tenant du super_admin", () => {
  const admin = adminClient();
  const state = newState();

  let tenantA: TestTenant;
  let tenantB: TestTenant;
  let superAdmin: TestUser;
  let apprenantTenantA: TestUser;

  beforeAll(async () => {
    tenantA = await createTestTenant(admin, state, "superadminA");
    tenantB = await createTestTenant(admin, state, "superadminB");
    superAdmin = await createTestUser(admin, state, { tenantId: null, role: "super_admin" });
    apprenantTenantA = await createTestUser(admin, state, { tenantId: tenantA.id, role: "apprenant" });
  });

  afterAll(async () => {
    await cleanupAll(admin, state);
  });

  it("le super_admin peut lire SA PROPRE ligne public.users (tenant_id NULL)", async () => {
    const { data, error } = await superAdmin.client
      .from("users")
      .select("id, role")
      .eq("id", superAdmin.id)
      .single();
    expect(error).toBeNull();
    expect(data?.role).toBe("super_admin");
  });

  it("le super_admin voit les utilisateurs de N'IMPORTE QUEL tenant", async () => {
    const { data, error } = await superAdmin.client
      .from("users")
      .select("id")
      .in("tenant_id", [tenantA.id, tenantB.id]);
    expect(error).toBeNull();
    expect(data?.map((u) => u.id)).toContain(apprenantTenantA.id);
  });

  it("le super_admin voit TOUS les tenants (pas seulement le sien, qui n'existe pas)", async () => {
    const { data, error } = await superAdmin.client
      .from("tenants")
      .select("id")
      .in("id", [tenantA.id, tenantB.id]);
    expect(error).toBeNull();
    expect(data?.map((t) => t.id).sort()).toEqual([tenantA.id, tenantB.id].sort());
  });

  it("un rôle non-super_admin ne voit que SON tenant, jamais les autres", async () => {
    const { data, error } = await apprenantTenantA.client
      .from("tenants")
      .select("id")
      .in("id", [tenantA.id, tenantB.id]);
    expect(error).toBeNull();
    expect(data?.map((t) => t.id)).toEqual([tenantA.id]);
  });
});
