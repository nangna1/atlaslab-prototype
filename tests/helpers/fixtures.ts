import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

// Prefixe distinctif de toutes les donnees creees par les tests, pour ne
// jamais pouvoir etre confondues avec les vraies donnees du projet Supabase
// de dev partage (voir README.md) contre lequel ces tests s'executent
// directement (pas de stack Supabase locale dans cet environnement).
export const TEST_PREFIX = "TEST_";

const PASSWORD = "Test-Passw0rd-Atlaslab!";

export function adminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// Un client anon frais par utilisateur signe : signInWithPassword met a jour
// la session EN MEMOIRE de cette instance (persistSession:false evite tout
// essai d'ecriture dans un storage navigateur inexistant sous Node), donc les
// requetes .from(...) suivantes sur ce client portent le JWT (et ses claims
// tenant_id/app_role injectees par le hook, voir 20260717010000_auth_hook.sql)
// de CET utilisateur precis.
function anonClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export type Role = "super_admin" | "admin_tenant" | "professeur" | "apprenant";

export interface TestUser {
  id: string;
  email: string;
  client: SupabaseClient;
}

export interface TestTenant {
  id: string;
  nom: string;
}

interface CreatedState {
  tenantIds: Set<string>;
  userIds: Set<string>;
}

export function newState(): CreatedState {
  return { tenantIds: new Set(), userIds: new Set() };
}

export async function createTestTenant(admin: SupabaseClient, state: CreatedState, label: string): Promise<TestTenant> {
  const suffix = randomUUID().slice(0, 8);
  const nom = `${TEST_PREFIX}${label}_${suffix}`;
  const { data, error } = await admin
    .from("tenants")
    .insert({ nom, slug: nom.toLowerCase().replace(/_/g, "-") })
    .select("id, nom")
    .single();
  if (error) throw new Error(`createTestTenant(${label}): ${error.message}`);
  state.tenantIds.add(data.id);
  return data;
}

// Cree un utilisateur auth.users + sa ligne public.users, et retourne un
// client Supabase deja connecte en son nom (voir anonClient ci-dessus) : le
// JWT porte donc les vraies claims tenant_id/app_role telles que le hook les
// calculerait en production, pas une valeur simulee cote test.
export async function createTestUser(
  admin: SupabaseClient,
  state: CreatedState,
  opts: { tenantId: string | null; role: Role; nom?: string; estModerateur?: boolean },
): Promise<TestUser> {
  const email = `${TEST_PREFIX.toLowerCase()}${randomUUID()}@atlaslab-tests.invalid`;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    throw new Error(`createTestUser auth.admin.createUser(${opts.role}): ${createErr?.message}`);
  }
  const userId = created.user.id;
  state.userIds.add(userId);

  const { error: insertErr } = await admin.from("users").insert({
    id: userId,
    tenant_id: opts.tenantId,
    role: opts.role,
    nom: opts.nom ?? `${TEST_PREFIX}${opts.role}`,
    est_moderateur: opts.estModerateur ?? false,
  });
  if (insertErr) throw new Error(`createTestUser insert public.users(${opts.role}): ${insertErr.message}`);

  const client = anonClient();
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInErr) throw new Error(`createTestUser signInWithPassword(${opts.role}): ${signInErr.message}`);

  return { id: userId, email, client };
}

// Supprime tout ce qui a ete cree pour un run de tests, dans l'ordre qui
// respecte les contraintes de cle etrangere (voir 20260717090000_cascade_deletes.sql :
// le cascade part de courses vers le bas, mais users/enrollments/tenants n'ont
// PAS de cascade entre eux, et auth.users<-public.users.id n'a pas non plus de
// cascade) :
//   1. courses de chaque tenant -> cascade modules/lessons/live_sessions/
//      assignments/submissions/enrollments/attendance/progress
//   2. lignes public.users de chaque tenant, PUIS des utilisateurs restants
//      (ex: super_admin, tenant_id null, jamais rattaches a un tenant ci-dessus)
//   3. comptes auth.users crees par les tests (apres coup : plus aucune ligne
//      public.users ne les reference a ce stade)
//   4. les tenants eux-memes
//
// IMPORTANT : ne PAS supprimer les auth.users tenant par tenant (l'ensemble
// userIds est partage entre tous les tenants d'un meme fichier de test) --
// sinon le premier tenant nettoye supprimerait au passage les comptes encore
// necessaires aux tenants suivants.
// Decode la partie payload d'un JWT (pas de verification de signature : on
// fait confiance a Supabase qui vient de nous le fournir, on veut juste lire
// les claims tenant_id/app_role injectees par le hook cote test).
export function decodeJwtPayload(accessToken: string): Record<string, unknown> {
  const payload = accessToken.split(".")[1];
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

export async function cleanupAll(admin: SupabaseClient, state: CreatedState) {
  for (const tenantId of state.tenantIds) {
    // paiements_frais.user_id/frais_id n'ont pas de cascade (voir
    // 20260801000000_frais_scolarite.sql) : a supprimer avant users/frais_scolarite
    // pour ne jamais violer de contrainte de cle etrangere ici.
    await admin.from("paiements_frais").delete().eq("tenant_id", tenantId);
    await admin.from("frais_scolarite").delete().eq("tenant_id", tenantId);
    await admin.from("courses").delete().eq("tenant_id", tenantId);
    await admin.from("enrollments").delete().eq("tenant_id", tenantId);
    await admin.from("users").delete().eq("tenant_id", tenantId);
  }
  for (const id of state.userIds) {
    await admin.from("users").delete().eq("id", id);
  }
  for (const id of state.userIds) {
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
  for (const tenantId of state.tenantIds) {
    await admin.from("tenants").delete().eq("id", tenantId);
  }
}
