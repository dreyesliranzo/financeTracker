"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePassword } from "@/lib/supabase/auth";
import { supabaseBrowser } from "@/lib/supabase/client";

const schema = z
  .object({
    password: z.string().min(6),
    confirmPassword: z.string().min(6)
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match"
  });

type Values = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  useEffect(() => {
    const supabase = supabaseBrowser();
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const accessToken = url.searchParams.get("access_token");
    const refreshToken = url.searchParams.get("refresh_token");

    if (code) {
      supabase.auth.exchangeCodeForSession(code).catch(() => null);
    } else if (accessToken && refreshToken) {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).catch(() => null);
    }
  }, []);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" }
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const { error } = await updatePassword(values.password);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated. You can sign in now.");
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Set a new password</h2>
        <p className="text-sm text-muted-foreground">
          Choose a new password for your account.
        </p>
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input id="password" type="password" {...form.register("password")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input id="confirmPassword" type="password" {...form.register("confirmPassword")} />
        </div>
        <Button type="submit" className="w-full">Update password</Button>
      </div>
      <div className="text-sm text-muted-foreground">
        Go back to{" "}
        <Link href="/login" className="hover:text-foreground">
          sign in
        </Link>
      </div>
    </form>
  );
}
