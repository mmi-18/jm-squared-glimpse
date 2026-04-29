import type { Metadata, Viewport } from "next";
import { Quicksand } from "next/font/google";
import "./globals.css";
import { getSiteUrl } from "@/lib/site";

const quicksand = Quicksand({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "glimpse.",
    template: "%s — glimpse.",
  },
  description:
    "glimpse. — matching creative freelancers with startups that need them.",
  // Linked manifest enables install-as-PWA on Android/Chrome/Edge.
  manifest: "/manifest.webmanifest",
  // iOS doesn't read the manifest; these meta tags drive standalone mode +
  // home-screen icon + status-bar tone when added via Safari → Share → Add
  // to Home Screen.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "glimpse",
  },
  // Hint to mobile UAs that this app supports portrait + standalone display.
  applicationName: "glimpse",
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
};

export const viewport: Viewport = {
  // Mobile-first; allow content under the iOS notch (paired with our
  // safe-area-inset paddings in TopNav / BottomNav / AppShell).
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a1a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${quicksand.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
