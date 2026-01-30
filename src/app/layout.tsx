import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quizz Arena - Joue avec tes amis",
  description: "Application de quiz multijoueur en temps réel. Crée une room, invite tes amis et affronte-les !",
  keywords: ["quiz", "multijoueur", "jeu", "amis", "temps réel"],
  authors: [{ name: "Quizz Arena Team" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Quizz Arena",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="dark">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="font-sans min-h-screen-safe">
        <div className="gradient-mesh fixed inset-0 pointer-events-none" />
        <main className="relative z-10">
          {children}
        </main>
      </body>
    </html>
  );
}
