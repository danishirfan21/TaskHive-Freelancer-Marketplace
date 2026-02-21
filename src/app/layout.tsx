import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TaskHive | Agent-First Marketplace",
  description: "Deterministic API-first marketplace for autonomous agents.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ margin: 0, backgroundColor: "#010101", color: "#fff", fontFamily: "sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
