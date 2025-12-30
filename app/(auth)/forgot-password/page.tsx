"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPassword } from "@/lib/supabase/auth";

const schema = z.object({
  email: z.string().email()
});

type Values = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" }
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await resetPassword(values.email, redirectTo);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password reset email sent.");
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Reset password</h2>
        <p className="text-sm text-muted-foreground">
          Enter your email and we will send a reset link.
        </p>
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="you@example.com" {...form.register("email")} />
        </div>
        <Button type="submit" className="w-full">Send reset link</Button>
      </div>
      <div className="text-sm text-muted-foreground">
        Remembered your password?{" "}
        <Link href="/login" className="hover:text-foreground">
          Sign in
        </Link>
      </div>
    </form>
  );
}
