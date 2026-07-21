import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  adminClient,
  newState,
  createTestTenant,
  createTestUser,
  cleanupAll,
  decodeJwtPayload,
} from "../helpers/fixtures";

// Tout le reste de la RLS (tenant_isolation_*, users_write_restricted_to_admin,
// content_write_restricted_to_staff...) repose sur les claims JWT tenant_id/
// app_role injectees par le hook custom_access_token_hook. Ce hook doit AUSSI
// etre active manuellement dans Supabase Dashboard -> Authentication -> Hooks
// (voir README.md, migration 20260717010000_auth_hook.sql) : une simple
// migration SQL ne suffit pas. Si ce test echoue avec des claims manquantes,
// c'est le premier endroit a verifier -- toutes les autres suites RLS
// echoueront pour la meme raison sinon.
describe("Hook JWT custom (tenant_id / app_role)", () => {
  const admin = adminClient();
  const state = newState();

  afterAll(async () => {
    await cleanupAll(admin, state);
  });

  it("injecte tenant_id et app_role dans le JWT a la connexion", async () => {
    const tenant = await createTestTenant(admin, state, "authhook");
    const user = await createTestUser(admin, state, { tenantId: tenant.id, role: "professeur" });

    const { data } = await user.client.auth.getSession();
    const token = data.session?.access_token;
    expect(token, "aucune session apres signInWithPassword").toBeTruthy();

    const claims = decodeJwtPayload(token!);
    expect(
      claims.tenant_id,
      "claim 'tenant_id' absente du JWT : le hook custom_access_token_hook " +
        "est-il bien active dans Dashboard > Authentication > Hooks ?",
    ).toBe(tenant.id);
    expect(claims.app_role, "claim 'app_role' absente du JWT").toBe("professeur");
  });

  it("laisse tenant_id absent pour un super_admin (tenant_id null)", async () => {
    const user = await createTestUser(admin, state, { tenantId: null, role: "super_admin" });
    const { data } = await user.client.auth.getSession();
    const claims = decodeJwtPayload(data.session!.access_token);
    expect(claims.tenant_id).toBeUndefined();
    expect(claims.app_role).toBe("super_admin");
  });
});
