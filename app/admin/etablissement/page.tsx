import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BrandingForm from "./BrandingForm";

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
    .select("nom, logo_url, couleur_primaire")
    .eq("id", profile.tenant_id)
    .single();

  return (
    <main className="page">
      <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">
        ← Retour aux comptes
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-semibold text-gray-900">
        Personnaliser {tenant?.nom}
      </h1>
      <BrandingForm
        currentLogoUrl={tenant?.logo_url ?? null}
        currentColor={tenant?.couleur_primaire ?? "#4f46e5"}
      />
    </main>
  );
}
