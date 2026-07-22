import { describe, it, expect, afterEach } from "vitest";
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit } from "../lib/rate-limit";

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function anonClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// rate_limit_attempts n'a pas de tenant/utilisateur -- chaque test utilise sa
// propre cle unique et se nettoie lui-meme, pas besoin de cleanupAll/fixtures.
const usedKeys: string[] = [];
function testKey(label: string): string {
  const cle = `test-ratelimit-${label}-${randomUUID()}`;
  usedKeys.push(cle);
  return cle;
}

describe("checkRateLimit (lib/rate-limit.ts)", () => {
  const admin = adminClient();

  afterEach(async () => {
    for (const cle of usedKeys.splice(0)) {
      await admin.from("rate_limit_attempts").delete().eq("cle", cle);
    }
  });

  it("autorise jusqu'à max tentatives, bloque la suivante", async () => {
    const cle = testKey("max");
    expect(await checkRateLimit(admin, cle, { max: 3, fenetreMinutes: 60 })).toBe(true);
    expect(await checkRateLimit(admin, cle, { max: 3, fenetreMinutes: 60 })).toBe(true);
    expect(await checkRateLimit(admin, cle, { max: 3, fenetreMinutes: 60 })).toBe(true);
    expect(await checkRateLimit(admin, cle, { max: 3, fenetreMinutes: 60 })).toBe(false);
  });

  it("une tentative refusée n'insère pas de nouvelle ligne (le compte ne grimpe pas indéfiniment)", async () => {
    const cle = testKey("norow");
    await checkRateLimit(admin, cle, { max: 1, fenetreMinutes: 60 });
    await checkRateLimit(admin, cle, { max: 1, fenetreMinutes: 60 }); // refusée
    await checkRateLimit(admin, cle, { max: 1, fenetreMinutes: 60 }); // refusée
    const { count } = await admin
      .from("rate_limit_attempts")
      .select("id", { count: "exact", head: true })
      .eq("cle", cle);
    expect(count).toBe(1);
  });

  it("une tentative hors fenêtre (created_at dans le passé) est nettoyée et ne compte plus", async () => {
    const cle = testKey("expired");
    const ancien = new Date(Date.now() - 120 * 60_000).toISOString(); // il y a 2h
    await admin.from("rate_limit_attempts").insert({ cle, created_at: ancien });

    // Fenêtre de 60 minutes : la tentative d'il y a 2h ne doit pas compter.
    expect(await checkRateLimit(admin, cle, { max: 1, fenetreMinutes: 60 })).toBe(true);

    const { data } = await admin.from("rate_limit_attempts").select("created_at").eq("cle", cle);
    expect((data ?? []).length).toBe(1); // l'ancienne ligne a été nettoyée, une seule (nouvelle) reste
  });

  it("deux clés différentes n'interfèrent pas entre elles", async () => {
    const cleA = testKey("a");
    const cleB = testKey("b");
    expect(await checkRateLimit(admin, cleA, { max: 1, fenetreMinutes: 60 })).toBe(true);
    expect(await checkRateLimit(admin, cleA, { max: 1, fenetreMinutes: 60 })).toBe(false);
    // cleB n'a jamais été utilisée : toujours disponible.
    expect(await checkRateLimit(admin, cleB, { max: 1, fenetreMinutes: 60 })).toBe(true);
  });
});

describe("rate_limit_attempts : deny-all sous RLS", () => {
  const admin = adminClient();
  const anon = anonClient();

  afterEach(async () => {
    for (const cle of usedKeys.splice(0)) {
      await admin.from("rate_limit_attempts").delete().eq("cle", cle);
    }
  });

  it("un client non authentifié ne peut ni lire ni écrire directement", async () => {
    const cle = testKey("rls");
    await admin.from("rate_limit_attempts").insert({ cle });

    const { data, error: selectError } = await anon.from("rate_limit_attempts").select("*").eq("cle", cle);
    expect(selectError).toBeNull();
    expect(data).toEqual([]); // deny-all : select vide silencieusement, pas d'erreur

    const { error: insertError } = await anon.from("rate_limit_attempts").insert({ cle: testKey("rls-insert") });
    expect(insertError).not.toBeNull();
  });
});
