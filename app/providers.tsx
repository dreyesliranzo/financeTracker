"use client";

import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { RealtimeProvider } from "@/components/providers/RealtimeProvider";
import { BootstrapProvider } from "@/components/providers/BootstrapProvider";
import { SuccessOverlay } from "@/components/ui/SuccessOverlay";
import { AccentProvider } from "@/components/providers/AccentProvider";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false
          }
        }
      })
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <AccentProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <BootstrapProvider>
              <RealtimeProvider>{children}</RealtimeProvider>
            </BootstrapProvider>
          </AuthProvider>
          <Toaster richColors />
          <SuccessOverlay />
        </QueryClientProvider>
      </AccentProvider>
    </ThemeProvider>
  );
}
