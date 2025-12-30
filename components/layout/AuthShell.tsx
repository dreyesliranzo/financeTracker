import { ReactNode } from "react";
import { Card } from "@/components/ui/card";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <div className="flex items-center gap-3 text-sm uppercase tracking-[0.3em] text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-primary" />
            Ledgerly
          </div>
          <h1 className="mt-3 text-3xl">Personal finance, synced.</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Secure, private, realtime tracking with a developer-tool feel.
          </p>
        </div>
        <Card className="border-border/60 bg-card/80 p-6 shadow-glow backdrop-blur">
          {children}
        </Card>
        <p className="mt-6 text-xs text-muted-foreground">
          By continuing you agree to our Terms and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
