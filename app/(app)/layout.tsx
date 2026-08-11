import AppSidebar from "./AppSidebar";
import MobileShell from "./MobileShell";

// Layout du groupe de routes (app) - non-racine (le root layout reste
// app/layout.tsx, qui garde <html>/<body>, polices, banners, service
// worker : voir la doc route-groups de cette version de Next dans
// node_modules/next/dist/docs/01-app/, aucun risque de double layout racine
// ici). La grille 248px/1fr + le comportement tiroir mobile sont geres par
// MobileShell.tsx (client, a besoin d'etat pour ouvrir/fermer le tiroir) -
// AppSidebar reste un composant serveur (fetch profil/tenant/notifications),
// passe en enfant plutot que rendu directement pour eviter de rendre tout
// MobileShell serveur-incompatible.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <MobileShell sidebar={<AppSidebar />}>{children}</MobileShell>;
}
