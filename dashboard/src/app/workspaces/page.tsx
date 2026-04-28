import { redirect } from "next/navigation";
import { getUserWorkspaces, setActiveWorkspaceAction } from "@/lib/workspace-session";
import { Building2, Plus, ArrowRight } from "lucide-react";
import Link from "next/link";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import WorkspaceCardClient from "@/components/dashboard/WorkspaceCardClient";

export default async function WorkspacesDashboard() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const workspaces = await getUserWorkspaces();

  return (
    <div className="min-h-screen bg-[#0a0a0b] p-8">
      {/* Background Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-blue-500/10 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-5xl mx-auto relative z-10">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Gerenciar Empresas</h1>
            <p className="text-white/60">Selecione um workspace para acessar o dashboard ou crie um novo.</p>
          </div>
          <Link
            href="/workspaces/create"
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2.5 px-5 rounded-lg flex items-center gap-2 transition-colors shadow-[0_0_20px_rgba(59,130,246,0.2)]"
          >
            <Plus className="w-5 h-5" />
            Criar Nova Empresa
          </Link>
        </div>

        {workspaces.length === 0 ? (
          <div className="bg-[#121214] border border-white/5 rounded-2xl p-12 text-center shadow-2xl backdrop-blur-xl">
            <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Building2 className="w-10 h-10 text-blue-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Nenhuma empresa encontrada</h2>
            <p className="text-white/50 mb-8 max-w-md mx-auto">
              Você ainda não possui nenhum workspace. Crie sua primeira empresa para começar a rastrear sua atribuição.
            </p>
            <Link
              href="/workspaces/create"
              className="inline-flex items-center justify-center gap-2 bg-white text-black font-bold py-3 px-8 rounded-xl hover:bg-white/90 transition-colors"
            >
              Começar Agora <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workspaces.map((workspace) => (
              <WorkspaceCardClient key={workspace.id} workspace={workspace} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
