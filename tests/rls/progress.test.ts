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

// progress_rls (20260717060000) : la table progress avait RLS activee sans
// aucune policy (donc totalement inaccessible) jusqu'a l'ajout de
// "user_id = auth.uid()" -- un utilisateur ne gere QUE sa propre progression,
// meme au sein du meme tenant/cours.
describe("Progression : chacun ne voit/modifie que la sienne", () => {
  const admin = adminClient();
  const state = newState();

  let tenant: TestTenant;
  let professeur: TestUser;
  let apprenantA: TestUser;
  let apprenantB: TestUser;
  let lesson: { id: string };

  beforeAll(async () => {
    tenant = await createTestTenant(admin, state, "progress");
    professeur = await createTestUser(admin, state, { tenantId: tenant.id, role: "professeur" });
    apprenantA = await createTestUser(admin, state, { tenantId: tenant.id, role: "apprenant" });
    apprenantB = await createTestUser(admin, state, { tenantId: tenant.id, role: "apprenant" });

    const { data: course } = await admin
      .from("courses")
      .insert({ tenant_id: tenant.id, titre: "Cours progression", professeur_id: professeur.id })
      .select("id")
      .single();
    const { data: moduleRow } = await admin
      .from("modules")
      .insert({ course_id: course!.id, titre: "Module", ordre: 1 })
      .select("id")
      .single();
    const { data: lessonRow } = await admin
      .from("lessons")
      .insert({ module_id: moduleRow!.id, titre: "Leçon", ordre: 1, type: "contenu" })
      .select("id")
      .single();
    lesson = lessonRow!;

    await admin.from("progress").insert({ user_id: apprenantB.id, lesson_id: lesson.id, statut: "termine", score: 18 });
  });

  afterAll(async () => {
    await cleanupAll(admin, state);
  });

  it("un apprenant peut créer/lire sa propre ligne de progression", async () => {
    const { error: insErr } = await apprenantA.client
      .from("progress")
      .insert({ user_id: apprenantA.id, lesson_id: lesson.id, statut: "en_cours" });
    expect(insErr).toBeNull();

    const { data, error } = await apprenantA.client
      .from("progress")
      .select("statut")
      .eq("user_id", apprenantA.id)
      .eq("lesson_id", lesson.id)
      .single();
    expect(error).toBeNull();
    expect(data?.statut).toBe("en_cours");
  });

  it("un apprenant ne voit pas la progression d'un autre apprenant", async () => {
    const { data, error } = await apprenantA.client
      .from("progress")
      .select("id")
      .eq("user_id", apprenantB.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("un apprenant ne peut pas modifier la progression d'un autre apprenant", async () => {
    await apprenantA.client.from("progress").update({ statut: "non_commence" }).eq("user_id", apprenantB.id);
    const { data } = await admin.from("progress").select("statut").eq("user_id", apprenantB.id).single();
    expect(data?.statut).toBe("termine");
  });
});
