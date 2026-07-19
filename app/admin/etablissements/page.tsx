import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CreateTenantForm from "./CreateTenantForm";
import TenantApprovalActions from "./TenantApprovalActions";

export default async function EtablissementsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "super_admin") {
    redirect("/admin");
  }

  const { data: allTenants } = await supabase
    .from("tenants")
    .select("id, nom, slug, plan, statut, created_at")
    .order("created_at");

  const pending = (allTenants ?? []).filter((t) => t.statut === "en_attente");
  const others = (allTenants ?? []).filter((t) => t.statut !== "en_attente");

  return (
    <main className="page">
      <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">
        ← Retour aux comptes
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-semibold text-gray-900">Établissements</h1>

      {pending.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Demandes en attente d&apos;approbation ({pending.length})
          </h2>
          <p className="mb-3 text-sm text-gray-500">
            Ces établissements se sont inscrits via le formulaire public. Leur admin ne peut pas
            se connecter tant que vous n&apos;avez pas approuvé la demande.
          </p>
          <div className="flex flex-col gap-2">
            {pending.map((tenant) => (
              <div
                key={tenant.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3"
              >
                <span className="text-gray-900">{tenant.nom}</span>
                <span className="text-sm text-gray-500">{tenant.slug}</span>
                <TenantApprovalActions tenantId={tenant.id} tenantNom={tenant.nom} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Créer un établissement</h2>
        <CreateTenantForm />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Établissements existants</h2>
        <div className="flex flex-col gap-2">
          {others.map((tenant) => (
            <div
              key={tenant.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3"
            >
              <span className="text-gray-900">{tenant.nom}</span>
              <span className="text-sm text-gray-500">{tenant.slug}</span>
              <span className="badge-muted">{tenant.plan}</span>
              {tenant.statut === "refuse" && <span className="badge-error">Refusé</span>}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
