import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDashboardStats } from "@/lib/dashboard-data";
import { toCsv } from "@/lib/csv-export";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Non authentifié.", { status: 401 });

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
    return new NextResponse("Non autorisé.", { status: 403 });
  }

  const { eleveStats, profStats } = await getDashboardStats(supabase);

  const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("fr-FR") : "");

  const rows = [
    ...eleveStats.map((e) => ["Élève", e.nom, e.leconsTerminees, e.devoirsRendus, "", "", formatDate(e.derniereActivite)]),
    ...profStats.map((p) => ["Professeur", p.nom, "", "", p.coursCrees, p.seancesProgrammees, formatDate(p.derniereActivite)]),
  ];

  const csv = toCsv(
    ["Type", "Nom", "Leçons terminées", "Devoirs rendus", "Cours créés", "Séances programmées", "Dernière activité"],
    rows,
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="tableau-de-bord.csv"',
    },
  });
}
