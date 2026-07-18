import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const FEATURES = [
  {
    titre: "Laboratoires virtuels",
    description: "Simulation SPICE (électronique) et logique numérique, 100% dans le navigateur, sans matériel physique.",
  },
  {
    titre: "Suivi de progression",
    description: "Tableau de bord par établissement : activité des élèves et des professeurs, journalière ou hebdomadaire.",
  },
  {
    titre: "Quiz & devoirs",
    description: "Quiz auto-corrigés, devoirs rendus et notés, présence aux séances en direct.",
  },
  {
    titre: "Multi-établissements",
    description: "Chaque établissement personnalise son logo, sa couleur et ses certificats de fin de cours.",
  },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/cours");

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-atlaslab.png" alt="AtlasLab" className="h-10 w-auto" />
        <Link href="/login" className="btn-link">
          Se connecter
        </Link>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="text-3xl font-semibold text-gray-900 sm:text-4xl">
          La plateforme LMS et laboratoires virtuels pour l&apos;enseignement technique et
          professionnel
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          Cours, quiz, devoirs, séances en direct et simulations réelles — une seule plateforme
          pour chaque établissement.
        </p>
        <Link href="/login" className="btn-primary mt-8 inline-flex">
          Se connecter
        </Link>
      </section>

      <section className="mx-auto grid max-w-5xl grid-cols-1 gap-4 px-6 pb-20 sm:grid-cols-2">
        {FEATURES.map((feature) => (
          <div key={feature.titre} className="card">
            <h2 className="font-semibold text-gray-900">{feature.titre}</h2>
            <p className="mt-1 text-sm text-gray-600">{feature.description}</p>
          </div>
        ))}
      </section>

      <footer className="mx-auto max-w-5xl px-6 pb-10 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} AtlasLab
      </footer>
    </main>
  );
}
