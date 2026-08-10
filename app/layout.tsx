import type { Metadata, Viewport } from "next";
import { Manrope, Noto_Naskh_Arabic, Geist_Mono } from "next/font/google";
import "./globals.css";
import RegisterServiceWorker from "./RegisterServiceWorker";
import OfflineStatusBanner from "./OfflineStatusBanner";
import DemoReturnBanner from "./DemoReturnBanner";
import { getLocale } from "@/lib/i18n/get-locale";
import { isRtl } from "@/lib/i18n/config";

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

// Libelles en arabe (selecteur de langue FR/EN/عربي) - voir app/globals.css
// ([lang="ar"] / .font-arabic).
const fontArabic = Noto_Naskh_Arabic({
  weight: ["400", "600"],
  variable: "--font-arabic",
  subsets: ["arabic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
  themeColor: "#0e1512",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      dir={isRtl(locale) ? "rtl" : "ltr"}
      className={`${fontDisplay.variable} ${fontBody.variable} ${fontArabic.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <DemoReturnBanner />
        <OfflineStatusBanner />
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
