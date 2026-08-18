import type { Metadata, Viewport } from "next";
import { Manrope, Geist_Mono } from "next/font/google";
import "./globals.css";
import RegisterServiceWorker from "./RegisterServiceWorker";
import OfflineStatusBanner from "./OfflineStatusBanner";
import DemoReturnBanner from "./DemoReturnBanner";
import AiAssistant from "./AiAssistant";
import { getLocale } from "@/lib/i18n/get-locale";
import { isRtl } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";

// Redesign 2026-08-10 : police unique Manrope (voir handoff design) pour
// titres et corps de texte - fontDisplay et fontBody pointent maintenant
// vers la meme famille. Les deux variables CSS sont conservees separement
// (plutot que fusionnees en une seule) pour ne rien casser des usages
// existants de var(--font-display)/var(--font-body) dans le reste de l'app.
const fontDisplay = Manrope({
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-display",
  subsets: ["latin"],
});

const fontBody = Manrope({
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Noto Naskh Arabic (libelles arabes du selecteur de langue) N'EST PAS
// chargee via next/font/google ici : ca compilait en local mais faisait
// echouer le build sur l'infra Vercel (Turbopack) avec "Module not found:
// Can't resolve '@vercel/turbopack-next/internal/font/google/font'" -
// verifie reellement via le log de build Vercel (2026-08-11), pas suppose.
// Repli sur un simple `font-family: 'Noto Naskh Arabic', serif` dans
// app/globals.css / app/LanguageSwitcher.tsx / app/(app)/AppSidebar.tsx
// (meme approche que l'app avant ce redesign) : le navigateur va chercher
// une police systeme correspondante plutot que d'en auto-heberger une via
// Next - acceptable ici, l'arabe ne couvre que 2 petits libelles de pastille.

export const metadata: Metadata = {
  title: "AtlasLab",
  description: "LMS et laboratoires virtuels pour l'enseignement technique et professionnel",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AtlasLab",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  // Role de l'utilisateur connecte, pour l'assistant IA (app/AiAssistant.tsx)
  // -- null si non connecte, auquel cas le composant ne s'affiche pas. Meme
  // requete que les autres pages authentifiees, reduite au seul champ
  // necessaire ici. Port depuis la branche assistant-ia-aide-utilisation
  // (2026-08-18) : logique inchangee, seule la police du layout racine
  // reste celle du redesign Manrope deja en place, pas celle de la branche.
  let role: string | null = null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
    role = profile?.role ?? null;
  }

  return (
    <html
      lang={locale}
      dir={isRtl(locale) ? "rtl" : "ltr"}
      className={`${fontDisplay.variable} ${fontBody.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <DemoReturnBanner />
        <OfflineStatusBanner />
        {children}
        <AiAssistant role={role} locale={locale} />
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
