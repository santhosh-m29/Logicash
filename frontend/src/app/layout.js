import "./globals.css";

export const metadata = {
  title: "Logicash — Full Stack CFO",
  description: "Intelligent financial decision-support system for small businesses. Prioritize payments, manage cash flow, and negotiate with vendors — all powered by deterministic logic.",
  manifest: "/manifest.json",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0a0e1a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#0a0e1a" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
