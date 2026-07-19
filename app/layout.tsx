import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Source_Serif_4, Geist_Mono } from "next/font/google";
import "./globals.css";
import RegisterServiceWorker from "./RegisterServiceWorker";
import OfflineStatusBanner from "./OfflineStatusBanner";
import { getLocale } from "@/lib/i18n/get-locale";
import { isRtl } from "@/lib/i18n/config";

const fontDisplay = Big_Shoulders({
  variable: "--font-display",
  subsets: ["latin"],
});

const fontBody = Source_Serif_4({
  variable: "--font-body",
  subsets: ["latin"],
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
  themeColor: "#16202c",
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
      className={`${fontDisplay.variable} ${fontBody.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <OfflineStatusBanner />
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
