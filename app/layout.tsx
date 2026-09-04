import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import localFont from "next/font/local";
import { ConvexClientProvider } from "@/components/convex-client-provider";
import { PageTransition } from "@/components/page-transition";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});


// Self-hosteada: el CSS que sirve Google va sin @layer y en Tailwind v4 lo
// no-capado gana sobre las utilities, así que su `font-size: 24px` pisaba los
// `text-[18px]` del markup. La clase .material-symbols-outlined vive en
// globals.css, dentro de @layer base.
const materialSymbols = localFont({
  src: "./fonts/material-symbols-outlined.woff2",
  variable: "--font-material-symbols",
  display: "block",
});

export const metadata: Metadata = {
  title: "CINSOFT 2026 // Registro a Talleres",
  description:
    "Registro a talleres del congreso CINSOFT 2026 — Facultad de Ingeniería en Computación & Telemática.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`dark ${spaceGrotesk.variable} ${jetbrainsMono.variable} ${materialSymbols.variable}`}
    >
      <body className="bg-background font-body-md text-on-surface bg-dot-matrix min-h-screen">
        <ConvexClientProvider>
          <SiteHeader />
          <PageTransition>{children}</PageTransition>
          <SiteFooter />
        </ConvexClientProvider>
      </body>
    </html>
  );
}
