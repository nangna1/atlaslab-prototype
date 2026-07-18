import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDashboardStats } from "@/lib/dashboard-data";

const BOM = "﻿";

function csvEscape(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function csvRow(values: (string | number)[]): string {
  return values.map(csvEscape).join(",");
}

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

  const rows: string[] = [];
  rows.push(
    csvRow(["Type", "Nom", "Leçons terminées", "Devoirs rendus", "Cours créés", "Séances programmées", "Dernière activité"]),
  );
  for (const e of eleveStats) {
    rows.push(csvRow(["Élève", e.nom, e.leconsTerminees, e.devoirsRendus, "", "", formatDate(e.derniereActivite)]));
  }
  for (const p of profStats) {
    rows.push(csvRow(["Professeur", p.nom, "", "", p.coursCrees, p.seancesProgrammees, formatDate(p.derniereActivite)]));
  }

  const csv = BOM + rows.join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="tableau-de-bord.csv"',
    },
  });
}
