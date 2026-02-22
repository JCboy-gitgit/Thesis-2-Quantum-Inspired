import type { Metadata, Viewport } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import Providers from "./components/Providers";
import { Toaster } from "./components/Toaster";
import "./globals.css";
import "./styles/green-theme.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const firaMono = Roboto_Mono({ subsets: ["latin"], variable: "--font-fira-mono" });

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
  themeColor: "#2EAF7D",
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
        var isLoginPage = window.location.pathname === '/' || window.location.pathname === '/login';
        
        var theme;
        if (isLoginPage) {
          var savedLoginTheme = localStorage.getItem('login-theme-preference');
          theme = (savedLoginTheme === 'dark' || savedLoginTheme === 'light') ? savedLoginTheme : 'light';
        } else {
          var themeKey = isFacultyPage ? 'faculty-base-theme' : 'admin-base-theme';
          var savedTheme = localStorage.getItem(themeKey);
          var validThemes = ['green', 'light', 'dark'];
          
          if (validThemes.includes(savedTheme)) {
            // Faculty pages should never use green theme
            if (isFacultyPage && savedTheme === 'green') {
              theme = 'light';
            } else {
              theme = savedTheme;
            }
          } else {
            // Default themes: light for faculty, green for admin
            theme = isFacultyPage ? 'light' : 'green';
          }
        }
        
        document.documentElement.setAttribute('data-theme', theme);
        
        // Set immediate background color to prevent white flash
        var bgColors = {
          green: '#f0fdf4',
          dark: '#0a0e27',
          light: '#ffffff'
        };
        document.documentElement.style.backgroundColor = bgColors[theme] || (isFacultyPage ? bgColors.light : bgColors.green);
      } catch (e) {
        document.documentElement.setAttribute('data-theme', 'green');
        document.documentElement.style.backgroundColor = '#f0fdf4';
      }
    })();
  `;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${inter.variable} ${firaMono.variable} antialiased`}
        style={{ backgroundColor: 'var(--background, #f0fdf4)' }}
      >
        <Providers>
          <Toaster />
          {children}
        </Providers>
      </body>
    </html>
  );
}
