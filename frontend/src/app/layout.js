import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import { BalanceProvider } from "@/context/BalanceContext";

export const metadata = {
  title: "Logicash — Full Stack CFO",
  description: "Intelligent financial decision-support system for small businesses. Prioritize payments, manage cash flow, and negotiate with vendors — all powered by deterministic logic.",
  manifest: "/manifest.json",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const savedTheme = localStorage.getItem('theme');
                const theme = savedTheme || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
                document.documentElement.setAttribute('data-theme', theme);
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <BalanceProvider>
            {children}
          </BalanceProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}