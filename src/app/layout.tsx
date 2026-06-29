import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "schvaleem",
  description: "Schvalovací systém + API pro AX 2012",
  icons: { icon: "/logo.png" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="cs">
      <body className="antialiased">{children}</body>
    </html>
  );
}
