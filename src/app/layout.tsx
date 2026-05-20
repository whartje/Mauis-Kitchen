import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/toaster";
import { Analytics } from "@vercel/analytics/react";
import Script from "next/script";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

// Controls the <meta name="viewport"> and <meta name="theme-color"> tags
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",   // fills behind iPhone notch / Dynamic Island
  themeColor: "#f97316",  // brand orange — tints the iOS status bar
};

export const metadata: Metadata = {
  title: "Maui's Kitchen",
  description: "Meal planning and recipe management — built around your ingredients.",
  // Tells Safari this app can run as a standalone PWA
  appleWebApp: {
    capable: true,
    title: "Maui's Kitchen",
    statusBarStyle: "black-translucent", // status bar blends into the app
  },
  // Both icons use API routes rather than the metadata-image convention
  // (icon.tsx / apple-icon.tsx) which fails silently on Vercel.
  icons: {
    icon: [{ url: "/api/favicon", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/api/pwa-icon", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      {/* suppressHydrationWarning: the inline script sets the theme class before hydration */}
      <html lang="en" suppressHydrationWarning>
        <head>
          {/* Prevent flash of wrong theme — runs before React hydrates */}
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){try{var t=localStorage.getItem('mauisKitchen_theme')||'dark';document.documentElement.classList.add(t);}catch(e){document.documentElement.classList.add('dark');}})();`,
            }}
          />
        </head>
        <body className={`${inter.variable} ${playfair.variable} font-sans antialiased`}>
          {children}
          <Toaster />
          <Analytics />
          {/* Google Analytics 4 */}
          <Script
            src="https://www.googletagmanager.com/gtag/js?id=G-9D64L2KFL2"
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-9D64L2KFL2');
            `}
          </Script>
        </body>
      </html>
    </ClerkProvider>
  );
}
