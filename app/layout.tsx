import type { Metadata } from "next";
import { Big_Shoulders, Source_Serif_4, Geist_Mono } from "next/font/google";
import "./globals.css";

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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fontDisplay.variable} ${fontBody.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
