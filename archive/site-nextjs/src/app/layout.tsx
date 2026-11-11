import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import { AgeGate } from "@/components/age-gate/AgeGate";
import { FloatingCart } from "@/components/cart/FloatingCart";
import { SiteFooter } from "@/components/footer/SiteFooter";
import { SiteHeader } from "@/components/header/SiteHeader";
import { CornerMarks } from "@/components/ui/CornerMarks";
import { AGE_GATE_BOOT_SCRIPT } from "@/lib/age-gate";
import { INTRO_BOOT_SCRIPT } from "@/lib/intro";
import "./globals.css";

const mono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "BluePoint Distribution — Vignerons d'exception, directement chez vous",
  description:
    "La sélection de Paolo Pioletti, à Lutry : vins d'Italie et de Suisse romande, achetés en direct aux vignerons et livrés sous 48 h.",
  // Maquette de présentation (photos provisoires) : non indexée par les moteurs de recherche.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr-CH" className={mono.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: AGE_GATE_BOOT_SCRIPT + INTRO_BOOT_SCRIPT }} />
      </head>
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
        <CornerMarks />
        <FloatingCart />
        <AgeGate />
      </body>
    </html>
  );
}
