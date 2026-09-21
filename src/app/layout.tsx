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
    "Gestão colaborativa de checklists e unidades de atendimento — a equipe inteira acompanha em tempo real.",
  icons: {
    icon: "/logo_oniocheck_quadrada.jpg",
    shortcut: "/logo_oniocheck_quadrada.jpg",
    apple: "/logo_oniocheck_quadrada.jpg",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
