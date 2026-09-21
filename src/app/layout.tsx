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
    icon: [
      {
        url: "/logo_oniocheck_png.png",
        sizes: "1024x1024",
        type: "image/png",
      },
      {
        url: "/logo_oniocheck_png.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        url: "/logo_oniocheck_png.png",
        sizes: "256x256",
        type: "image/png",
      },
      {
        url: "/logo_oniocheck_png.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],
    shortcut: "/logo_oniocheck_png.png",
    apple: {
      url: "/logo_oniocheck_png.png",
      sizes: "256x256",
      type: "image/png",
    },
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
