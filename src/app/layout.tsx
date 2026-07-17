import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  metadataBase: new URL("https://lecouncilduvin.co.za"),
  title: "Le Council du Vin",
  description: "in vino veritas: a secret order of the vine.",
  robots: "noindex, nofollow",
  // Controls the link-preview image WhatsApp (and others) unfurl when a
  // meeting is shared — the black-gold full logo rather than the favicon.
  openGraph: {
    title: "Le Council du Vin",
    description: "in vino veritas",
    images: [{ url: "/share-card.png", width: 1000, height: 1000 }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="robots" content="noindex, nofollow" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600&family=EB+Garamond:ital@0;1&family=Cormorant+Garamond:ital,wght@1,500&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.24.0/dist/tabler-icons.min.css"
        />
      </head>
      <body>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
