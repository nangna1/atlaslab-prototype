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
import { encryptSecret, decryptSecret } from "../../lib/crypto-secrets";
import { getTenantCinetPayConfig, hasTenantCinetPayConfig, saveTenantCinetPayConfig } from "../../lib/tenant-cinetpay";

// Identifiants marchand CinetPay par etablissement : table sans AUCUNE policy
// RLS (deny-all pour tout role authentifie, y compris admin_tenant/
// super_admin -- seul le service_role peut y toucher, exclusivement via
// lib/tenant-cinetpay.ts). Voir 20260806000000_tenant_paiement_config.sql.

describe("chiffrement des secrets (lib/crypto-secrets.ts)", () => {
  it("roundtrip encryptSecret/decryptSecret retrouve la valeur d'origine", () => {
    const original = "cinetpay-secret-key-de-test-123456";
    const stored = encryptSecret(original);
    expect(stored).not.toBe(original);
    expect(decryptSecret(stored)).toBe(original);
  });

  it("deux chiffrements de la meme valeur produisent des resultats differents (IV aleatoire)", () => {
    const a = encryptSecret("meme-valeur");
    const b = encryptSecret("meme-valeur");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe("meme-valeur");
    expect(decryptSecret(b)).toBe("meme-valeur");
  });
});

describe("tenant_paiement_config : deny-all sous RLS, accessible uniquement en service-role", () => {
  const admin = adminClient();
  const state = newState();

  let tenant: TestTenant;
  let adminTenant: TestUser;
  let superAdmin: TestUser;

  beforeAll(async () => {
    tenant = await createTestTenant(admin, state, "paiementconfig");
    adminTenant = await createTestUser(admin, state, { tenantId: tenant.id, role: "admin_tenant" });
    superAdmin = await createTestUser(admin, state, { tenantId: null, role: "super_admin" });
  });

  afterAll(async () => {
    await cleanupAll(admin, state);
  });

  it("admin_tenant ne peut pas lire tenant_paiement_config directement (client RLS)", async () => {
    await admin.from("tenant_paiement_config").insert({
      tenant_id: tenant.id,
      site_id: "site123",
      api_key_chiffre: encryptSecret("apikey-test"),
      secret_key_chiffre: encryptSecret("secret-test"),
    });
    const { data, error } = await adminTenant.client
      .from("tenant_paiement_config")
      .select("*")
      .eq("tenant_id", tenant.id);
    expect(error).toBeNull(); // select vide silencieusement filtre (pas d'erreur), comme toute policy RLS
    expect(data).toEqual([]);
  });

  it("admin_tenant ne peut pas insérer dans tenant_paiement_config directement (client RLS)", async () => {
    const { error } = await adminTenant.client.from("tenant_paiement_config").upsert({
      tenant_id: tenant.id,
      site_id: "site-pirate",
      api_key_chiffre: "x",
      secret_key_chiffre: "x",
    });
    expect(error).not.toBeNull();
  });

  it("super_admin ne peut pas non plus lire tenant_paiement_config directement (aucune policy, meme role)", async () => {
    const { data, error } = await superAdmin.client
      .from("tenant_paiement_config")
      .select("*")
      .eq("tenant_id", tenant.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("le client service-role peut lire/écrire normalement (sanity check)", async () => {
    const { data, error } = await admin
      .from("tenant_paiement_config")
      .select("site_id")
      .eq("tenant_id", tenant.id)
      .single();
    expect(error).toBeNull();
    expect(data?.site_id).toBe("site123");
  });
});

describe("lib/tenant-cinetpay.ts : sauvegarde/lecture bout-en-bout", () => {
  const admin = adminClient();
  const state = newState();

  let tenant: TestTenant;

  beforeAll(async () => {
    tenant = await createTestTenant(admin, state, "paiementconfiglib");
  });

  afterAll(async () => {
    await cleanupAll(admin, state);
  });

  it("hasTenantCinetPayConfig retourne false avant toute configuration", async () => {
    expect(await hasTenantCinetPayConfig(admin, tenant.id)).toBe(false);
  });

  it("saveTenantCinetPayConfig puis getTenantCinetPayConfig renvoie les mêmes valeurs en clair", async () => {
    await saveTenantCinetPayConfig(admin, tenant.id, {
      apiKey: "ma-cle-api",
      siteId: "mon-site-id",
      secretKey: "ma-cle-secrete",
    });

    expect(await hasTenantCinetPayConfig(admin, tenant.id)).toBe(true);

    const creds = await getTenantCinetPayConfig(admin, tenant.id);
    expect(creds).toEqual({ apiKey: "ma-cle-api", siteId: "mon-site-id", secretKey: "ma-cle-secrete" });
  });

  it("getTenantCinetPayConfig retourne null pour un tenant sans configuration", async () => {
    const autreTenant = await createTestTenant(admin, state, "paiementconfigsansconf");
    expect(await getTenantCinetPayConfig(admin, autreTenant.id)).toBeNull();
  });
});
