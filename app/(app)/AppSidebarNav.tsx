"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavLink = { href: string; label: string; badge?: number };

// Regle d'etat actif : /cours est actif aussi pour les sous-pages de cours
// (/cours/[id]/...) SAUF /cours/catalogue, qui a sa propre entree. Les
// autres liens sont actifs sur correspondance exacte ou prefixe.
function isActive(pathname: string, href: string): boolean {
  if (href === "/cours") {
    return pathname === "/cours" || (pathname.startsWith("/cours/") && !pathname.startsWith("/cours/catalogue"));
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Ligne de nav (lien de route) - meme habillage que le declencheur de
// notifications (bouton, pas une route : voir NotificationBell.tsx, qui
// reprend les memes classes/styles directement plutot que de partager ce
// composant, un bouton n'ayant pas les memes props qu'un <Link>).
export function NavRow({
  active,
  children,
  href,
  ...linkProps
}: { active: boolean; children: React.ReactNode; href: string } & Omit<
  React.ComponentProps<typeof Link>,
  "href" | "className" | "style"
>) {
  return (
    <Link
      href={href}
      className="flex w-full items-center gap-[11px] rounded-[10px] px-3 py-2.5 text-left text-sm transition-colors"
      style={{
        background: active ? "var(--line)" : "transparent",
        color: active ? "var(--text)" : "var(--text-muted)",
        fontWeight: active ? 700 : 500,
      }}
      {...linkProps}
    >
      {children}
    </Link>
  );
}

export function NavDot({ active }: { active: boolean }) {
  return (
    <span
      className="h-[7px] w-[7px] rounded-full"
      style={{ background: active ? "var(--accent)" : "var(--inactive-dot)" }}
    />
  );
}

export default function AppSidebarNav({ links }: { links: NavLink[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-[3px]">
      {links.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <NavRow key={link.href} href={link.href} active={active}>
            <NavDot active={active} />
            <span className="flex-1">{link.label}</span>
            {!!link.badge && link.badge > 0 && (
              <span
                className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold"
                style={{ background: "var(--accent)", color: "var(--on-accent)" }}
              >
                {link.badge}
              </span>
            )}
          </NavRow>
        );
      })}
    </nav>
  );
}
