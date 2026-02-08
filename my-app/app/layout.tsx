import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Providers from "./components/Providers";
import { Toaster } from "./components/Toaster";
import "./globals.css";
import "./styles/green-theme.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Qtime Scheduler",
  description: "Quantum-Inspired Room Scheduling System",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#00331a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Inline script to prevent theme flash - runs before React hydration
  const themeInitScript = `
    (function() {
      try {
        var isFacultyPage = window.location.pathname.startsWith('/faculty');
        var savedTheme = localStorage.getItem('faculty-base-theme');
        var validThemes = ['green', 'light', 'dark'];
        var theme = validThemes.includes(savedTheme) ? savedTheme : (isFacultyPage ? 'light' : 'green');
        
        // Faculty pages should never use green theme
        if (isFacultyPage && theme === 'green') {
          theme = 'light';
        }
        
        document.documentElement.setAttribute('data-theme', theme);
        
        // Set immediate background color to prevent white flash
        var bgColors = {
          green: '#00331a',
          dark: '#0a0e27',
          light: '#f8fafc'
        };
        document.documentElement.style.backgroundColor = bgColors[theme] || (isFacultyPage ? bgColors.light : bgColors.green);
      } catch (e) {
        document.documentElement.setAttribute('data-theme', 'green');
        document.documentElement.style.backgroundColor = '#00331a';
      }
    })();
  `;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ backgroundColor: 'var(--background, #00331a)' }}
      >
        <Providers>
          <Toaster />
          {children}
        </Providers>
      </body>
    </html>
  );
}
