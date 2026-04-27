import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WebDev Suite — Build, Edit, Preview, Deploy",
  description: "A full web development suite with a live visual HTML & style editor.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-950 text-slate-100">{children}</body>
    </html>
  );
}
