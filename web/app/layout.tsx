import ConvexClientProvider from "@/components/ConvexClientProvider";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import type { Metadata } from "next";
import { Space_Grotesk, Space_Mono, Syne } from "next/font/google";
import "./globals.css";
import ClientLayout from "./ClientLayout";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["700", "800"],
  display: "swap"
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap"
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap"
});

export const metadata: Metadata = {
  title: "Hypershelf",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://hypershelf.dgazizullin.dev"
  ),
  description: "Hypershelf - digital assets inventory",
  openGraph: {
    title: "Hypershelf",
    description: "Hypershelf - digital assets inventory",
    type: "website",
    images: [
      {
        url: "/meta/og-image.png"
      }
    ]
  },
  twitter: {
    title: "Hypershelf",
    description: "Hypershelf - digital assets inventory",
    card: "summary_large_image",
    images: ["/meta/og-image.png"]
  },
  icons: {
    icon: [
      { url: "/meta/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/meta/favicon.svg", type: "image/svg+xml" }
    ],
    shortcut: [{ url: "/meta/favicon.ico" }],
    apple: [{ url: "/meta/apple-touch-icon.png", sizes: "180x180" }]
  },
  manifest: "/meta/site.webmanifest"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html lang="en">
        <body
          className={`${syne.variable} ${spaceGrotesk.variable} ${spaceMono.variable} bg-background font-sans antialiased`}
        >
          <ConvexClientProvider>
            <ClientLayout>{children}</ClientLayout>
          </ConvexClientProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
