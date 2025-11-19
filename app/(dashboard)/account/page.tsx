import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase";
import { ProfileForm } from "./profile-form";

export default async function AccountPage() {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, company_name, role")
    .eq("id", session.user.id)
    .maybeSingle();

  const hydratedProfile = {
    fullName:
      profile?.full_name ||
      (session.user.user_metadata?.full_name as string | undefined) ||
      session.user.email ||
      "",
    email: profile?.email || session.user.email || "",
    companyName:
      profile?.company_name ||
      (session.user.user_metadata?.company_name as string | undefined) ||
      "",
    role:
      profile?.role ||
      (session.user.user_metadata?.role as string | undefined) ||
      "",
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10 space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase text-primary">Account</p>
        <h1 className="text-3xl font-bold tracking-tight">Your profile</h1>
        <p className="text-muted-foreground">
          Keep your personal details up to date for newsletters and AI prompts.
        </p>
      </div>

      <ProfileForm profile={hydratedProfile} />
    </div>
  );
}
