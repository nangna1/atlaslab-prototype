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

// Module Frais de scolarite / Paiements : contrairement aux autres
// fonctionnalites staff (offres_emploi, insertions_professionnelles...), le
// professeur est volontairement EXCLU de toute policy ici -- decision produit
// confirmee (donnees financieres plus sensibles), voir
// supabase/migrations/20260801000000_frais_scolarite.sql.
describe("Frais de scolarité : écriture réservée à admin_tenant/super_admin (professeur exclu)", () => {
  const admin = adminClient();
  const state = newState();

  let tenant: TestTenant;
  let adminTenant: TestUser;
  let professeur: TestUser;
  let apprenant: TestUser;

  beforeAll(async () => {
    tenant = await createTestTenant(admin, state, "frais");
    adminTenant = await createTestUser(admin, state, { tenantId: tenant.id, role: "admin_tenant" });
    professeur = await createTestUser(admin, state, { tenantId: tenant.id, role: "professeur" });
    apprenant = await createTestUser(admin, state, { tenantId: tenant.id, role: "apprenant" });
  });

  afterAll(async () => {
    await cleanupAll(admin, state);
  });

  it("admin_tenant peut créer un frais pour son tenant", async () => {
    const { error } = await adminTenant.client
      .from("frais_scolarite")
      .insert({ tenant_id: tenant.id, libelle: "Scolarité T1", montant: 50000, cree_par: adminTenant.id });
    expect(error).toBeNull();
  });

  it("un professeur ne peut pas créer de frais", async () => {
    const { error } = await professeur.client
      .from("frais_scolarite")
      .insert({ tenant_id: tenant.id, libelle: "Frais pirate", montant: 1000, cree_par: professeur.id });
    expect(error).not.toBeNull();
  });

  it("un apprenant ne peut pas créer de frais", async () => {
    const { error } = await apprenant.client
      .from("frais_scolarite")
      .insert({ tenant_id: tenant.id, libelle: "Frais pirate", montant: 1000, cree_par: apprenant.id });
    expect(error).not.toBeNull();
  });

  it("tout le monde du tenant peut LIRE les frais (select non restreint par rôle)", async () => {
    const { data, error } = await professeur.client.from("frais_scolarite").select("id").eq("tenant_id", tenant.id);
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
  });
});

describe("Paiements : professeur exclu même en lecture, élève limité à ses propres paiements", () => {
  const admin = adminClient();
  const state = newState();

  let tenant: TestTenant;
  let adminTenant: TestUser;
  let professeur: TestUser;
  let apprenantA: TestUser;
  let apprenantB: TestUser;
  let frais: { id: string };

  beforeAll(async () => {
    tenant = await createTestTenant(admin, state, "paiements");
    adminTenant = await createTestUser(admin, state, { tenantId: tenant.id, role: "admin_tenant" });
    professeur = await createTestUser(admin, state, { tenantId: tenant.id, role: "professeur" });
    apprenantA = await createTestUser(admin, state, { tenantId: tenant.id, role: "apprenant" });
    apprenantB = await createTestUser(admin, state, { tenantId: tenant.id, role: "apprenant" });

    const { data } = await admin
      .from("frais_scolarite")
      .insert({ tenant_id: tenant.id, libelle: "Frais test", montant: 20000, cree_par: adminTenant.id })
      .select("id")
      .single();
    frais = data!;

    await admin.from("paiements_frais").insert({
      tenant_id: tenant.id,
      frais_id: frais.id,
      user_id: apprenantA.id,
      montant: 5000,
      moyen_paiement: "especes",
      enregistre_par: adminTenant.id,
    });
  });

  afterAll(async () => {
    await cleanupAll(admin, state);
  });

  it("admin_tenant peut enregistrer un paiement pour n'importe quel élève de son tenant", async () => {
    const { error } = await adminTenant.client.from("paiements_frais").insert({
      tenant_id: tenant.id,
      frais_id: frais.id,
      user_id: apprenantB.id,
      montant: 3000,
      moyen_paiement: "mobile_money",
      enregistre_par: adminTenant.id,
    });
    expect(error).toBeNull();
  });

  it("un professeur ne peut pas enregistrer de paiement", async () => {
    const { error } = await professeur.client.from("paiements_frais").insert({
      tenant_id: tenant.id,
      frais_id: frais.id,
      user_id: apprenantA.id,
      montant: 1000,
      moyen_paiement: "especes",
      enregistre_par: professeur.id,
    });
    expect(error).not.toBeNull();
  });

  it("un élève ne peut pas enregistrer lui-même un paiement (staff uniquement)", async () => {
    const { error } = await apprenantA.client.from("paiements_frais").insert({
      tenant_id: tenant.id,
      frais_id: frais.id,
      user_id: apprenantA.id,
      montant: 1000,
      moyen_paiement: "especes",
      enregistre_par: apprenantA.id,
    });
    expect(error).not.toBeNull();
  });

  it("un élève voit son propre paiement", async () => {
    const { data, error } = await apprenantA.client
      .from("paiements_frais")
      .select("id")
      .eq("user_id", apprenantA.id);
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("un élève ne voit PAS le paiement d'un autre élève", async () => {
    const { data, error } = await apprenantA.client
      .from("paiements_frais")
      .select("id")
      .eq("user_id", apprenantB.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("un professeur ne voit AUCUN paiement, y compris ceux de ses propres élèves", async () => {
    const { data, error } = await professeur.client
      .from("paiements_frais")
      .select("id")
      .eq("tenant_id", tenant.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("admin_tenant voit tous les paiements du tenant", async () => {
    const { data, error } = await adminTenant.client
      .from("paiements_frais")
      .select("id")
      .eq("tenant_id", tenant.id);
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThanOrEqual(2);
  });
});

describe("Isolation multi-tenant (frais_scolarite / paiements_frais)", () => {
  const admin = adminClient();
  const state = newState();

  let tenantA: TestTenant;
  let tenantB: TestTenant;
  let adminA: TestUser;
  let adminB: TestUser;
  let fraisB: { id: string };

  beforeAll(async () => {
    tenantA = await createTestTenant(admin, state, "isoA");
    tenantB = await createTestTenant(admin, state, "isoB");
    adminA = await createTestUser(admin, state, { tenantId: tenantA.id, role: "admin_tenant" });
    adminB = await createTestUser(admin, state, { tenantId: tenantB.id, role: "admin_tenant" });

    const { data } = await admin
      .from("frais_scolarite")
      .insert({ tenant_id: tenantB.id, libelle: "Frais tenant B", montant: 10000, cree_par: adminB.id })
      .select("id")
      .single();
    fraisB = data!;
  });

  afterAll(async () => {
    await cleanupAll(admin, state);
  });

  it("admin_tenant A ne voit aucun frais du tenant B", async () => {
    const { data, error } = await adminA.client.from("frais_scolarite").select("id").eq("tenant_id", tenantB.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("admin_tenant A ne peut pas enregistrer de paiement contre un frais du tenant B", async () => {
    const { error } = await adminA.client.from("paiements_frais").insert({
      tenant_id: tenantA.id,
      frais_id: fraisB.id,
      user_id: adminA.id,
      montant: 1000,
      moyen_paiement: "especes",
      enregistre_par: adminA.id,
    });
    expect(error).not.toBeNull();
  });
});
