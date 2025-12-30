import { supabaseBrowser } from "./client";

export async function signInWithPassword(email: string, password: string) {
  const supabase = supabaseBrowser();
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithPassword(email: string, password: string) {
  const supabase = supabaseBrowser();
  return supabase.auth.signUp({ email, password });
}

export async function signOut() {
  const supabase = supabaseBrowser();
  return supabase.auth.signOut();
}

export async function resetPassword(email: string, redirectTo: string) {
  const supabase = supabaseBrowser();
  return supabase.auth.resetPasswordForEmail(email, { redirectTo });
}

export async function updatePassword(password: string) {
  const supabase = supabaseBrowser();
  return supabase.auth.updateUser({ password });
}
