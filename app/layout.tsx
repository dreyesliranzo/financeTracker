import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import { plexMono, spaceGrotesk } from "./fonts";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Ledgerly",
  description: "Personal finance tracking with realtime sync."
};

export default function RootLayout({
  children
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning data-accent="iris">
      <body
        className={`${spaceGrotesk.variable} ${plexMono.variable} min-h-screen bg-background text-foreground`}
      >
        <Providers>
          {children}
          <Toaster richColors />
        </Providers>
      </body>
    </html>
  );
}
