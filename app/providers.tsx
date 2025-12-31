"use client";

import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { RealtimeProvider } from "@/components/providers/RealtimeProvider";
import { BootstrapProvider } from "@/components/providers/BootstrapProvider";
import { AccentProvider } from "@/components/providers/AccentProvider";
import { CommandPalette } from "@/components/command/CommandPalette";
import { GlobalSearch } from "@/components/search/GlobalSearch";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            refetchOnMount: false
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
          <CommandPalette />
          <GlobalSearch />
        </QueryClientProvider>
      </AccentProvider>
    </ThemeProvider>
  );
}
