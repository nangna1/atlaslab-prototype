import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MfaManager from "./MfaManager";

export default async function SecuritePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  const isAdmin = ["admin_tenant", "super_admin"].includes(profile?.role ?? "");

  return (
    <main className="page max-w-sm">
      <Link href="/cours" className="text-sm text-gray-500 hover:text-gray-700">
        ← Retour à mes cours
      </Link>
      <h1 className="mt-2 mb-2 text-2xl font-semibold text-gray-900">Sécurité du compte</h1>
      <p className="mb-6 text-sm" style={{ color: "var(--ink-soft)" }}>
        {isAdmin
          ? "Recommandé pour votre rôle : activez la double authentification pour protéger ce compte administrateur."
          : "Protégez votre compte avec une double authentification (application d'authentification)."}
      </p>
      <MfaManager />
    </main>
  );
}
