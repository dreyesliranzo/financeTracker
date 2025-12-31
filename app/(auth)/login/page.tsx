"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithPassword } from "@/lib/supabase/auth";
import { successToast } from "@/lib/feedback";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" }
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const { error } = await signInWithPassword(values.email, values.password);
    if (error) {
      toast.error(error.message);
      return;
    }
    successToast("Login successful", "Welcome back!");
    await new Promise((resolve) => setTimeout(resolve, 350));
    router.push("/dashboard" as Route);
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Sign in</h2>
        <p className="text-sm text-muted-foreground">
          Use your email to access your workspace.
        </p>
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="you@example.com" {...form.register("email")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" {...form.register("password")} />
        </div>
        <Button type="submit" className="w-full">Sign in</Button>
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <Link href="/forgot-password" className="hover:text-foreground">
          Forgot password?
        </Link>
        <Link href="/signup" className="hover:text-foreground">
          Create account
        </Link>
      </div>
    </form>
  );
}
