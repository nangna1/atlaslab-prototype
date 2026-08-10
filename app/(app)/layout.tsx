import AppSidebar from "./AppSidebar";

// Layout du groupe de routes (app) - non-racine (le root layout reste
// app/layout.tsx, qui garde <html>/<body>, polices, banners, service
// worker : voir la doc route-groups de cette version de Next dans
// node_modules/next/dist/docs/01-app/, aucun risque de double layout racine
// ici). Grille 248px/1fr, sidebar sticky pleine hauteur (voir AppSidebar.tsx).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-[248px_1fr]">
      <AppSidebar />
      <main className="min-w-0">{children}</main>
    </div>
  );
}
