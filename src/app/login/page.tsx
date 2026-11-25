import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { getDemoCredentials } from "@/lib/supabase/demo-config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function LoginPage() {
  const supabaseConfig = getSupabaseConfig();
  const demoConfig = getDemoCredentials();

  if (supabaseConfig.isConfigured) {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      redirect("/");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b0d12] px-4 py-12">
      <LoginForm
        supabaseConfigured={supabaseConfig.isConfigured}
        demoConfigured={demoConfig.isConfigured}
      />
    </main>
  );
}
