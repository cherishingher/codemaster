import type { Metadata } from "next";
import { IBM_Plex_Mono, Manrope } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";
import { Navbar } from "@/components/layout/navbar";
import { AppShell } from "@/components/layout/app-shell";
import { Toaster } from "sonner";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "CodeMaster",
  description: "High-density problem solving workspace for OJ, Scratch and admin workflows.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${manrope.variable} ${plexMono.variable} min-h-screen bg-background text-foreground`}
      >
        <Navbar />
        <AppShell>{children}</AppShell>
        <Toaster
          position="top-right"
          richColors
          toastOptions={{
            classNames: {
              toast: "!rounded-2xl !border !border-border/70 !bg-card !text-card-foreground !shadow-[0_24px_60px_-36px_rgba(15,23,42,0.35)]",
              title: "!text-sm !font-semibold",
              description: "!text-sm !leading-6 !text-muted-foreground",
            },
          }}
        />
      </body>
    </html>
  );
}
