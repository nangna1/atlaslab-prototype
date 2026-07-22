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

// Plan 'essai' : 30 jours ET 30 comptes apprenant+professeur max (voir
// supabase/migrations/20260804000000_tenant_essai_limites.sql). La policy
// est additive sur tenant_isolation_users_insert (remplace la version sans
// limite) : role not in ('apprenant','professeur') OU limite non atteinte.
describe("Limite d'essai : un tenant neuf peut créer des comptes normalement", () => {
  const admin = adminClient();
  const state = newState();

  let tenant: TestTenant;
  let adminTenant: TestUser;

  beforeAll(async () => {
    tenant = await createTestTenant(admin, state, "essaifrais");
    adminTenant = await createTestUser(admin, state, { tenantId: tenant.id, role: "admin_tenant" });
  });

  afterAll(async () => {
    await cleanupAll(admin, state);
  });

  it("admin_tenant peut créer un apprenant sur un tenant en essai récent, sous la limite", async () => {
    const email = `test_essai_frais_${crypto.randomUUID()}@atlaslab-tests.invalid`;
    const { data: created } = await admin.auth.admin.createUser({
      email,
      password: "Test-Passw0rd-Atlaslab!",
      email_confirm: true,
    });
    state.userIds.add(created!.user!.id);

    const { error } = await adminTenant.client
      .from("users")
      .insert({ id: created!.user!.id, tenant_id: tenant.id, role: "apprenant", nom: "Nouvel élève" });
    expect(error).toBeNull();
  });

  it("admin_tenant peut créer un compte parent (jamais compté dans la limite)", async () => {
    const email = `test_essai_frais_parent_${crypto.randomUUID()}@atlaslab-tests.invalid`;
    const { data: created } = await admin.auth.admin.createUser({
      email,
      password: "Test-Passw0rd-Atlaslab!",
      email_confirm: true,
    });
    state.userIds.add(created!.user!.id);

    const { error } = await adminTenant.client
      .from("users")
      .insert({ id: created!.user!.id, tenant_id: tenant.id, role: "parent", nom: "Parent test" });
    expect(error).toBeNull();
  });
});

describe("Limite d'essai : tenant expiré (>30 jours) bloque les nouveaux comptes apprenant/professeur", () => {
  const admin = adminClient();
  const state = newState();

  let tenant: TestTenant;
  let adminTenant: TestUser;
  let professeur: TestUser;

  beforeAll(async () => {
    tenant = await createTestTenant(admin, state, "essaiexpire");
    adminTenant = await createTestUser(admin, state, { tenantId: tenant.id, role: "admin_tenant" });
    professeur = await createTestUser(admin, state, { tenantId: tenant.id, role: "professeur" });

    const ancienneDate = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString();
    await admin.from("tenants").update({ created_at: ancienneDate }).eq("id", tenant.id);
  });

  afterAll(async () => {
    await cleanupAll(admin, state);
  });

  it("un admin_tenant ne peut pas ajouter public.users pour un NOUVEAU compte apprenant existant en auth", async () => {
    // Cree d'abord un vrai compte auth (sans ligne public.users) pour tester
    // uniquement la policy de limite, pas la contrainte de cle etrangere.
    const email = `test_essai_expire_${crypto.randomUUID()}@atlaslab-tests.invalid`;
    const { data: created } = await admin.auth.admin.createUser({
      email,
      password: "Test-Passw0rd-Atlaslab!",
      email_confirm: true,
    });
    state.userIds.add(created!.user!.id);

    const { error } = await adminTenant.client
      .from("users")
      .insert({ id: created!.user!.id, tenant_id: tenant.id, role: "apprenant", nom: "Trop tard" });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/row-level security/i);
  });

  it("un professeur existant reste pleinement lisible/actif (pas de coupure retroactive)", async () => {
    const { data, error } = await adminTenant.client.from("users").select("id").eq("id", professeur.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });
});

describe("Limite d'essai : 30 comptes atteints bloque un 31e, plan standard n'a aucune limite", () => {
  const admin = adminClient();
  const state = newState();

  let tenantEssai: TestTenant;
  let tenantStandard: TestTenant;
  let adminEssai: TestUser;
  let adminStandard: TestUser;

  beforeAll(async () => {
    tenantEssai = await createTestTenant(admin, state, "essaiplein");
    tenantStandard = await createTestTenant(admin, state, "standardsanslimite");
    adminEssai = await createTestUser(admin, state, { tenantId: tenantEssai.id, role: "admin_tenant" });
    adminStandard = await createTestUser(admin, state, { tenantId: tenantStandard.id, role: "admin_tenant" });
    await admin.from("tenants").update({ plan: "standard" }).eq("id", tenantStandard.id);

    // 30 comptes apprenant pour saturer la limite du tenant essai (comptes
    // auth minimalistes, pas de session complete necessaire pour ce test).
    for (let i = 0; i < 30; i++) {
      const email = `test_essai_plein_${i}_${crypto.randomUUID()}@atlaslab-tests.invalid`;
      const { data: created } = await admin.auth.admin.createUser({
        email,
        password: "Test-Passw0rd-Atlaslab!",
        email_confirm: true,
      });
      state.userIds.add(created!.user!.id);
      await admin.from("users").insert({ id: created!.user!.id, tenant_id: tenantEssai.id, role: "apprenant", nom: `Élève ${i}` });
    }
  }, 60000);

  afterAll(async () => {
    await cleanupAll(admin, state);
  });

  it("le 31e compte apprenant est refusé sur le tenant essai plein", async () => {
    const email = `test_essai_plein_31_${crypto.randomUUID()}@atlaslab-tests.invalid`;
    const { data: created } = await admin.auth.admin.createUser({
      email,
      password: "Test-Passw0rd-Atlaslab!",
      email_confirm: true,
    });
    state.userIds.add(created!.user!.id);

    const { error } = await adminEssai.client
      .from("users")
      .insert({ id: created!.user!.id, tenant_id: tenantEssai.id, role: "apprenant", nom: "Élève 31" });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/row-level security/i);
  });

  it("un tenant en plan standard n'a aucune limite, même avec un tenant essai plein en parallèle", async () => {
    const email = `test_standard_${crypto.randomUUID()}@atlaslab-tests.invalid`;
    const { data: created } = await admin.auth.admin.createUser({
      email,
      password: "Test-Passw0rd-Atlaslab!",
      email_confirm: true,
    });
    state.userIds.add(created!.user!.id);

    const { error } = await adminStandard.client
      .from("users")
      .insert({ id: created!.user!.id, tenant_id: tenantStandard.id, role: "apprenant", nom: "Élève standard" });
    expect(error).toBeNull();
  });
});
