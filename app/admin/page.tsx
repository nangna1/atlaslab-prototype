import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CreateAccountForm from "./CreateAccountForm";
import ImportAccountsForm from "./ImportAccountsForm";
import AccountRow from "./AccountRow";
import OnboardingChecklist from "./OnboardingChecklist";
import AdminNav from "./AdminNav";
import { matchesQuery } from "@/lib/search";
import { getLimiteEssai } from "@/lib/tenant-plan";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string }>;
}) {
  const { q: qRaw, role: roleFilter } = await searchParams;
  const q = (qRaw ?? "").trim();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id, est_moderateur")
    .eq("id", user.id)
    .single();

  const isFullAdmin = !!profile && ["admin_tenant", "super_admin"].includes(profile.role);
  const isModerateur = !!profile && profile.role === "professeur" && profile.est_moderateur;

  if (!profile || (!isFullAdmin && !isModerateur)) {
    redirect("/cours");
  }

  const VALID_ROLES = ["professeur", "apprenant", "admin_tenant"];
  let comptesQuery = supabase
    .from("users")
    .select("id, nom, email, telephone, role, actif, est_moderateur")
    .order("nom");
  if (isModerateur) {
    // Un moderateur ne gere que les eleves -- pas de filtre par role a proposer.
    comptesQuery = comptesQuery.eq("role", "apprenant");
  } else if (roleFilter && VALID_ROLES.includes(roleFilter)) {
    comptesQuery = comptesQuery.eq("role", roleFilter);
  }
  const { data: allComptes } = await comptesQuery;
  const comptes = q
    ? (allComptes ?? []).filter((c) => matchesQuery(c.nom, q) || matchesQuery(c.email, q))
    : allComptes;

  const limiteEssai = profile.role === "admin_tenant" ? await getLimiteEssai(supabase, profile.tenant_id) : null;

  return (
    <main className="page">
      {isFullAdmin && <AdminNav isSuperAdmin={profile.role === "super_admin"} canManageFinances={isFullAdmin} />}
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">
        {isFullAdmin ? "Comptes" : "Mes élèves"}
      </h1>

      {limiteEssai && (
        <div
          className={`mb-6 rounded-lg border p-3 text-sm ${
            limiteEssai.limiteAtteinte
              ? "border-red-300 bg-red-50 text-red-700"
              : "border-amber-300 bg-amber-50 text-amber-700"
          }`}
        >
          {limiteEssai.limiteAtteinte
            ? "Période d'essai terminée ou limite de comptes atteinte : impossible de créer de nouveaux comptes apprenant/professeur. Contactez AtlasLab pour passer à un plan payant."
            : `Période d'essai : ${limiteEssai.nbComptes}/30 comptes utilisés, ${limiteEssai.joursRestants} jour(s) restant(s).`}
        </div>
      )}

      {isFullAdmin && profile.tenant_id && (
        <OnboardingChecklist supabase={supabase} tenantId={profile.tenant_id} />
      )}

      {isFullAdmin && (
        <>
          <section className="mb-10">
            <h2 className="mb-3 text-lg font-semibold text-gray-900">Créer un compte</h2>
            <CreateAccountForm />
          </section>

          <section className="mb-10">
            <ImportAccountsForm />
          </section>
        </>
      )}

      <section>
        {isFullAdmin && <h2 className="mb-3 text-lg font-semibold text-gray-900">Comptes existants</h2>}
        <form method="get" className="mb-4 flex flex-wrap gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Rechercher un compte (nom, email)…"
            className="input max-w-sm"
          />
          {isFullAdmin && (
            <select name="role" defaultValue={roleFilter ?? ""} className="input w-auto">
              <option value="">Tous les rôles</option>
              <option value="admin_tenant">Admin établissement</option>
              <option value="professeur">Professeur</option>
              <option value="apprenant">Apprenant</option>
            </select>
          )}
          <button type="submit" className="btn-secondary shrink-0">
            Filtrer
          </button>
        </form>
        {(comptes ?? []).length === 0 && (
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
            Aucun compte ne correspond à ces critères.
          </p>
        )}
        <div className="flex flex-col gap-2">
          {(comptes ?? []).map((compte) => (
            <AccountRow
              key={compte.id}
              compte={compte}
              isSelf={compte.id === user.id}
              isFullAdmin={isFullAdmin}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
