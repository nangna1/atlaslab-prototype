import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function PortailParentPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "parent") redirect("/cours");

  const { data: liens } = await supabase
    .from("parents_enfants")
    .select("enfant_id, users!parents_enfants_enfant_id_fkey(nom)")
    .eq("parent_id", user.id);

  const enfants = (liens ?? []).map((l) => ({
    id: l.enfant_id,
    nom: (l.users as unknown as { nom: string } | null)?.nom ?? "Élève",
  }));

  return (
    <main className="page">
      <h1 className="mb-2 text-2xl font-semibold text-gray-900">Portail parents</h1>
      <p className="mb-6 text-sm text-gray-500">Vos enfants inscrits sur AtlasLab.</p>

      {enfants.length === 0 ? (
        <p className="text-sm text-gray-500">
          Aucun enfant relié à votre compte pour le moment. Contactez l&apos;établissement.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {enfants.map((e) => (
            <Link
              key={e.id}
              href={`/portail-parent/${e.id}`}
              className="rounded-lg border border-gray-200 bg-white p-3 font-medium text-gray-900 hover:bg-gray-50"
            >
              {e.nom}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
