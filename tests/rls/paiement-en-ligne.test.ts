import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "crypto";
import {
  adminClient,
  newState,
  createTestTenant,
  createTestUser,
  cleanupAll,
  TestUser,
  TestTenant,
} from "../helpers/fixtures";

// Paiement en ligne (CinetPay) : contrairement a paiements_frais (ecriture
// staff uniquement), paiements_frais_transactions est initiee par l'eleve/
// parent lui-meme. Voir supabase/migrations/20260805000000_paiement_en_ligne_cinetpay.sql.
describe("Paiements en ligne : initiation limitée à soi-même", () => {
  const admin = adminClient();
  const state = newState();

  let tenant: TestTenant;
  let adminTenant: TestUser;
  let apprenantA: TestUser;
  let apprenantB: TestUser;
  let frais: { id: string };

  beforeAll(async () => {
    tenant = await createTestTenant(admin, state, "paiementligne");
    adminTenant = await createTestUser(admin, state, { tenantId: tenant.id, role: "admin_tenant" });
    apprenantA = await createTestUser(admin, state, { tenantId: tenant.id, role: "apprenant" });
    apprenantB = await createTestUser(admin, state, { tenantId: tenant.id, role: "apprenant" });

    const { data } = await admin
      .from("frais_scolarite")
      .insert({ tenant_id: tenant.id, libelle: "Frais test en ligne", montant: 15000, cree_par: adminTenant.id })
      .select("id")
      .single();
    frais = data!;
  });

  afterAll(async () => {
    await cleanupAll(admin, state);
  });

  it("un élève peut initier un paiement pour lui-même", async () => {
    const { error } = await apprenantA.client.from("paiements_frais_transactions").insert({
      tenant_id: tenant.id,
      frais_id: frais.id,
      user_id: apprenantA.id,
      montant: 5000,
      transaction_id: `test-${randomUUID()}`,
    });
    expect(error).toBeNull();
  });

  it("un élève ne peut pas initier un paiement pour un autre élève", async () => {
    const { error } = await apprenantA.client.from("paiements_frais_transactions").insert({
      tenant_id: tenant.id,
      frais_id: frais.id,
      user_id: apprenantB.id,
      montant: 5000,
      transaction_id: `test-${randomUUID()}`,
    });
    expect(error).not.toBeNull();
  });

  it("un élève voit ses propres transactions", async () => {
    const { data, error } = await apprenantA.client
      .from("paiements_frais_transactions")
      .select("id")
      .eq("user_id", apprenantA.id);
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("un élève ne voit pas les transactions d'un autre élève", async () => {
    await admin.from("paiements_frais_transactions").insert({
      tenant_id: tenant.id,
      frais_id: frais.id,
      user_id: apprenantB.id,
      montant: 5000,
      transaction_id: `test-${randomUUID()}`,
    });
    const { data, error } = await apprenantA.client
      .from("paiements_frais_transactions")
      .select("id")
      .eq("user_id", apprenantB.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("admin_tenant voit toutes les transactions du tenant", async () => {
    const { data, error } = await adminTenant.client
      .from("paiements_frais_transactions")
      .select("id")
      .eq("tenant_id", tenant.id);
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("un élève ne peut pas faire passer sa transaction à 'reussi' lui-même", async () => {
    const transactionId = `test-${randomUUID()}`;
    await apprenantA.client.from("paiements_frais_transactions").insert({
      tenant_id: tenant.id,
      frais_id: frais.id,
      user_id: apprenantA.id,
      montant: 2000,
      transaction_id: transactionId,
    });
    // USING matche la ligne (proprietaire, encore en_attente) mais la clause
    // WITH CHECK (n'autorise que 'echoue'/'annule') rejette le resultat --
    // Postgres leve une erreur RLS explicite ici, ce n'est pas un no-op silencieux.
    const { error } = await apprenantA.client
      .from("paiements_frais_transactions")
      .update({ statut: "reussi" })
      .eq("transaction_id", transactionId);
    expect(error).not.toBeNull();
    const { data } = await admin
      .from("paiements_frais_transactions")
      .select("statut")
      .eq("transaction_id", transactionId)
      .single();
    expect(data?.statut).toBe("en_attente");
  });

  it("un élève peut annuler sa propre transaction en attente", async () => {
    const transactionId = `test-${randomUUID()}`;
    await apprenantA.client.from("paiements_frais_transactions").insert({
      tenant_id: tenant.id,
      frais_id: frais.id,
      user_id: apprenantA.id,
      montant: 2000,
      transaction_id: transactionId,
    });
    const { error } = await apprenantA.client
      .from("paiements_frais_transactions")
      .update({ statut: "annule" })
      .eq("transaction_id", transactionId);
    expect(error).toBeNull();
    const { data } = await admin
      .from("paiements_frais_transactions")
      .select("statut")
      .eq("transaction_id", transactionId)
      .single();
    expect(data?.statut).toBe("annule");
  });
});

describe("Isolation multi-tenant (paiements_frais_transactions)", () => {
  const admin = adminClient();
  const state = newState();

  let tenantA: TestTenant;
  let tenantB: TestTenant;
  let apprenantA: TestUser;
  let adminB: TestUser;
  let fraisB: { id: string };

  beforeAll(async () => {
    tenantA = await createTestTenant(admin, state, "paiementligneisoA");
    tenantB = await createTestTenant(admin, state, "paiementligneisoB");
    apprenantA = await createTestUser(admin, state, { tenantId: tenantA.id, role: "apprenant" });
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

  it("un élève du tenant A ne peut pas initier de paiement contre un frais du tenant B", async () => {
    const { error } = await apprenantA.client.from("paiements_frais_transactions").insert({
      tenant_id: tenantA.id,
      frais_id: fraisB.id,
      user_id: apprenantA.id,
      montant: 1000,
      transaction_id: `test-${randomUUID()}`,
    });
    expect(error).not.toBeNull();
  });
});

describe("confirmer_paiement_en_ligne : réservé au service-role, atomique et idempotent", () => {
  const admin = adminClient();
  const state = newState();

  let tenant: TestTenant;
  let adminTenant: TestUser;
  let apprenant: TestUser;
  let frais: { id: string };

  beforeAll(async () => {
    tenant = await createTestTenant(admin, state, "confirmpaiement");
    adminTenant = await createTestUser(admin, state, { tenantId: tenant.id, role: "admin_tenant" });
    apprenant = await createTestUser(admin, state, { tenantId: tenant.id, role: "apprenant" });

    const { data } = await admin
      .from("frais_scolarite")
      .insert({ tenant_id: tenant.id, libelle: "Frais confirmation", montant: 8000, cree_par: adminTenant.id })
      .select("id")
      .single();
    frais = data!;
  });

  afterAll(async () => {
    await cleanupAll(admin, state);
  });

  it("un utilisateur authentifié ne peut pas appeler le RPC directement", async () => {
    const transactionId = `test-${randomUUID()}`;
    await admin.from("paiements_frais_transactions").insert({
      tenant_id: tenant.id,
      frais_id: frais.id,
      user_id: apprenant.id,
      montant: 4000,
      transaction_id: transactionId,
    });
    const { error } = await apprenant.client.rpc("confirmer_paiement_en_ligne", {
      p_transaction_id: transactionId,
      p_moyen_paiement: "orange_money_ci",
    });
    expect(error).not.toBeNull();
  });

  it("le service-role crédite la transaction et insère paiements_frais", async () => {
    const transactionId = `test-${randomUUID()}`;
    await admin.from("paiements_frais_transactions").insert({
      tenant_id: tenant.id,
      frais_id: frais.id,
      user_id: apprenant.id,
      montant: 4000,
      transaction_id: transactionId,
    });

    const { data: paiementId, error } = await admin.rpc("confirmer_paiement_en_ligne", {
      p_transaction_id: transactionId,
      p_moyen_paiement: "orange_money_ci",
    });
    expect(error).toBeNull();
    expect(paiementId).toBeTruthy();

    const { data: paiement } = await admin
      .from("paiements_frais")
      .select("montant, moyen_paiement, enregistre_par, user_id")
      .eq("id", paiementId)
      .single();
    expect(paiement?.montant).toBe(4000);
    expect(paiement?.moyen_paiement).toBe("orange_money_ci");
    expect(paiement?.enregistre_par).toBeNull();
    expect(paiement?.user_id).toBe(apprenant.id);

    const { data: txn } = await admin
      .from("paiements_frais_transactions")
      .select("statut, paiement_id")
      .eq("transaction_id", transactionId)
      .single();
    expect(txn?.statut).toBe("reussi");
    expect(txn?.paiement_id).toBe(paiementId);
  });

  it("un second appel avec le même transaction_id est un no-op (pas de double crédit)", async () => {
    const transactionId = `test-${randomUUID()}`;
    await admin.from("paiements_frais_transactions").insert({
      tenant_id: tenant.id,
      frais_id: frais.id,
      user_id: apprenant.id,
      montant: 3000,
      transaction_id: transactionId,
    });

    const first = await admin.rpc("confirmer_paiement_en_ligne", {
      p_transaction_id: transactionId,
      p_moyen_paiement: "wave_ci",
    });
    expect(first.data).toBeTruthy();

    const second = await admin.rpc("confirmer_paiement_en_ligne", {
      p_transaction_id: transactionId,
      p_moyen_paiement: "wave_ci",
    });
    expect(second.data).toBeNull();

    const { data: paiements } = await admin
      .from("paiements_frais")
      .select("id")
      .eq("reference", transactionId);
    expect((paiements ?? []).length).toBe(1);
  });

  it("une transaction déjà échouée ne peut pas être créditée", async () => {
    const transactionId = `test-${randomUUID()}`;
    await admin.from("paiements_frais_transactions").insert({
      tenant_id: tenant.id,
      frais_id: frais.id,
      user_id: apprenant.id,
      montant: 2000,
      transaction_id: transactionId,
      statut: "echoue",
    });

    const { data } = await admin.rpc("confirmer_paiement_en_ligne", {
      p_transaction_id: transactionId,
      p_moyen_paiement: "carte_bancaire",
    });
    expect(data).toBeNull();
  });
});
