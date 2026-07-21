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

// Emploi du temps (creneaux_horaires) : meme patron RLS que modules/lessons
// (20260717070000_content_write_restricted_to_staff.sql) -- pas de
// restriction "son propre cours" pour un professeur, n'importe quel staff du
// tenant peut ecrire sur n'importe quel cours du tenant, coherent avec le
// reste du contenu pedagogique. Restriction "apprenant ne voit que ses cours
// inscrits" heritee automatiquement de la RLS de courses (cascade).
describe("Créneaux horaires : écriture réservée au staff, lecture cascade via courses", () => {
  const admin = adminClient();
  const state = newState();

  let tenant: TestTenant;
  let professeur: TestUser;
  let apprenantInscrit: TestUser;
  let apprenantNonInscrit: TestUser;
  let course: { id: string };

  beforeAll(async () => {
    tenant = await createTestTenant(admin, state, "emploi");
    professeur = await createTestUser(admin, state, { tenantId: tenant.id, role: "professeur" });
    apprenantInscrit = await createTestUser(admin, state, { tenantId: tenant.id, role: "apprenant" });
    apprenantNonInscrit = await createTestUser(admin, state, { tenantId: tenant.id, role: "apprenant" });

    const { data: c } = await admin
      .from("courses")
      .insert({ tenant_id: tenant.id, titre: "Cours emploi du temps", professeur_id: professeur.id })
      .select("id")
      .single();
    course = c!;

    await admin
      .from("enrollments")
      .insert({ tenant_id: tenant.id, user_id: apprenantInscrit.id, course_id: course.id });
  });

  afterAll(async () => {
    await cleanupAll(admin, state);
  });

  it("un professeur peut créer un créneau pour un cours de son tenant", async () => {
    const { error } = await professeur.client
      .from("creneaux_horaires")
      .insert({ course_id: course.id, jour: 0, heure_debut: "08:00", heure_fin: "10:00", salle: "A1" });
    expect(error).toBeNull();
  });

  it("un apprenant ne peut pas créer de créneau", async () => {
    const { error } = await apprenantInscrit.client
      .from("creneaux_horaires")
      .insert({ course_id: course.id, jour: 1, heure_debut: "08:00", heure_fin: "10:00" });
    expect(error).not.toBeNull();
  });

  it("un apprenant inscrit voit le créneau de son cours", async () => {
    const { data, error } = await apprenantInscrit.client
      .from("creneaux_horaires")
      .select("id")
      .eq("course_id", course.id);
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("un apprenant NON inscrit ne voit pas le créneau de ce cours", async () => {
    const { data, error } = await apprenantNonInscrit.client
      .from("creneaux_horaires")
      .select("id")
      .eq("course_id", course.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("un apprenant ne peut pas supprimer un créneau", async () => {
    const { data: creneau } = await admin.from("creneaux_horaires").select("id").eq("course_id", course.id).single();
    await apprenantInscrit.client.from("creneaux_horaires").delete().eq("id", creneau!.id);
    const { data: verif } = await admin.from("creneaux_horaires").select("id").eq("id", creneau!.id).single();
    expect(verif?.id).toBe(creneau!.id);
  });

  it("un professeur peut supprimer un créneau", async () => {
    const { data: creneau } = await professeur.client
      .from("creneaux_horaires")
      .insert({ course_id: course.id, jour: 2, heure_debut: "14:00", heure_fin: "16:00" })
      .select("id")
      .single();
    const { error } = await professeur.client.from("creneaux_horaires").delete().eq("id", creneau!.id);
    expect(error).toBeNull();
  });

  it("le trigger check heure_fin > heure_debut rejette un créneau invalide", async () => {
    const { error } = await professeur.client
      .from("creneaux_horaires")
      .insert({ course_id: course.id, jour: 3, heure_debut: "10:00", heure_fin: "09:00" });
    expect(error).not.toBeNull();
  });
});

describe("Isolation multi-tenant (creneaux_horaires)", () => {
  const admin = adminClient();
  const state = newState();

  let tenantA: TestTenant;
  let tenantB: TestTenant;
  let professeurA: TestUser;
  let courseB: { id: string };

  beforeAll(async () => {
    tenantA = await createTestTenant(admin, state, "emploiA");
    tenantB = await createTestTenant(admin, state, "emploiB");
    professeurA = await createTestUser(admin, state, { tenantId: tenantA.id, role: "professeur" });
    const professeurB = await createTestUser(admin, state, { tenantId: tenantB.id, role: "professeur" });

    const { data } = await admin
      .from("courses")
      .insert({ tenant_id: tenantB.id, titre: "Cours tenant B", professeur_id: professeurB.id })
      .select("id")
      .single();
    courseB = data!;
  });

  afterAll(async () => {
    await cleanupAll(admin, state);
  });

  it("un professeur du tenant A ne peut pas créer de créneau sur un cours du tenant B", async () => {
    const { error } = await professeurA.client
      .from("creneaux_horaires")
      .insert({ course_id: courseB.id, jour: 0, heure_debut: "08:00", heure_fin: "10:00" });
    expect(error).not.toBeNull();
  });

  it("un professeur du tenant A ne voit aucun créneau du tenant B", async () => {
    await admin.from("creneaux_horaires").insert({ course_id: courseB.id, jour: 0, heure_debut: "08:00", heure_fin: "10:00" });
    const { data, error } = await professeurA.client
      .from("creneaux_horaires")
      .select("id")
      .eq("course_id", courseB.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
