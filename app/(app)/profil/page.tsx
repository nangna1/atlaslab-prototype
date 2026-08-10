import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileForm from "./ProfileForm";
import ChangePasswordForm from "./ChangePasswordForm";

export default async function ProfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("nom, email, telephone")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/cours");

  return (
    <main className="page max-w-sm">
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">Mon profil</h1>
      <ProfileForm nom={profile.nom} telephone={profile.telephone} email={profile.email} />
      <ChangePasswordForm />
    </main>
  );
}
