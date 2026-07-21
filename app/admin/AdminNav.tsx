import Link from "next/link";

type NavLink = { href: string; label: string };
type NavGroup = { label: string; links: NavLink[] };

export default function AdminNav({
  isSuperAdmin,
  canManageFinances,
}: {
  isSuperAdmin: boolean;
  canManageFinances: boolean;
}) {
  const groups: NavGroup[] = [
    {
      label: "Pilotage",
      links: [
        { href: "/admin/tableau-de-bord", label: "Tableau de bord" },
        { href: "/admin/rapport-impact", label: "Rapport d'impact" },
        { href: "/admin/decrochage", label: "Alerte de décrochage" },
        { href: "/admin/audit", label: "Historique d'audit" },
      ],
    },
    {
      label: "Élèves & carrière",
      links: [
        { href: "/admin/insertion-professionnelle", label: "Insertion professionnelle" },
        { href: "/admin/offres", label: "Bourse aux stages/emplois" },
      ],
    },
    // Donnees financieres reservees a admin_tenant/super_admin (voir
    // app/admin/frais-scolarite/actions.ts) -- groupe masque au professeur.
    ...(canManageFinances
      ? [
          {
            label: "Finances",
            links: [
              { href: "/admin/frais-scolarite", label: "Frais de scolarité" },
              { href: "/admin/paiements", label: "Paiements" },
            ],
          },
        ]
      : []),
    {
      label: "Établissement",
      links: [
        { href: "/admin/etablissement", label: "Personnaliser mon établissement" },
        ...(isSuperAdmin ? [{ href: "/admin/etablissements", label: "Gérer les établissements" }] : []),
      ],
    },
  ];

  return (
    <nav className="mb-8 grid grid-cols-1 gap-6 border-b pb-6 sm:grid-cols-3" style={{ borderColor: "var(--line)" }}>
      {groups.map((group) => (
        <div key={group.label}>
          <p
            className="mb-2 text-xs font-semibold tracking-[0.12em] uppercase"
            style={{ fontFamily: "var(--font-mono)", color: "var(--brand)" }}
          >
            {group.label}
          </p>
          <div className="flex flex-col items-start gap-1">
            {group.links.map((link) => (
              <Link key={link.href} href={link.href} className="btn-link">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
