import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasTenantCinetPayConfig } from "@/lib/tenant-cinetpay";
import BrandingForm from "./BrandingForm";
import PaiementGatewayForm from "./PaiementGatewayForm";

export default async function EtablissementSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single();

  if (
    !profile ||
    !["admin_tenant", "super_admin"].includes(profile.role) ||
    !profile.tenant_id
  ) {
    redirect("/admin");
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("nom, logo_url, couleur_primaire, adresse, numero_agrement, representant_legal, certificat_modele")
    .eq("id", profile.tenant_id)
    .single();

  const paiementConfigure = await hasTenantCinetPayConfig(createAdminClient(), profile.tenant_id);

  return (
    <main className="page">
      <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">
        ← Retour aux comptes
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-semibold text-gray-900">
        Personnaliser {tenant?.nom}
      </h1>

      <section className="card-dashed mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
            Exporter toutes les données de l&apos;établissement
          </p>
          <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
            Comptes, cours, notes, présences, insertions, offres — une archive ZIP de fichiers CSV.
          </p>
        </div>
        <a href="/admin/exporter-donnees" className="btn-secondary shrink-0">
          Télécharger l&apos;export
        </a>
      </section>

      <BrandingForm
        currentLogoUrl={tenant?.logo_url ?? null}
        currentColor={tenant?.couleur_primaire ?? "#4f46e5"}
        currentAdresse={tenant?.adresse ?? ""}
        currentNumeroAgrement={tenant?.numero_agrement ?? ""}
        currentRepresentantLegal={tenant?.representant_legal ?? ""}
        currentCertificatModele={tenant?.certificat_modele ?? "classique"}
      />

      <div className="mt-8">
        <PaiementGatewayForm configured={paiementConfigure} />
      </div>
    </main>
  );
}
