import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    redirect("/");
  }

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <p className="text-sm font-semibold text-primary">Repatch</p>
        <h1 className="text-3xl font-bold tracking-tight">
          Sign in to your workspace
        </h1>
        <p className="text-muted-foreground">
          Manage patch notes, subscribers, and AI templates with Supabase Auth.
        </p>
      </div>
      <LoginForm />
    </div>
  );
}
