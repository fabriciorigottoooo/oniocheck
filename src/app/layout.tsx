import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "OnioCheck · Checklist de clientes",
  description:
    "Gestão colaborativa de checklists e unidades de atendimento.",
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'%3E%3Ctext y='95' font-size='72' font-family='Arial, sans-serif' font-weight='700' fill='%230f172a'%3Eo%3C/text%3E%3C/svg%3E",
    shortcut: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'%3E%3Ctext y='95' font-size='72' font-family='Arial, sans-serif' font-weight='700' fill='%230f172a'%3Eo%3C/text%3E%3C/svg%3E",
    apple: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'%3E%3Ctext y='95' font-size='72' font-family='Arial, sans-serif' font-weight='700' fill='%230f172a'%3Eo%3C/text%3E%3C/svg%3E",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
