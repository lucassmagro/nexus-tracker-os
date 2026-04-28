import DashboardLayout from "../dashboard-layout";
import { Shield } from "lucide-react";
import { getActiveWorkspaceId } from "@/lib/workspace-session";

export default async function AdminPage() {
  const activeWorkspaceId = await getActiveWorkspaceId();
  
  return (
    <DashboardLayout>
      <div className="p-8 max-w-6xl mx-auto space-y-8">
        <div className="flex items-center gap-4 border-b border-white/5 pb-6">
          <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center">
            <Shield className="w-6 h-6 text-purple-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Painel do Super Administrador</h1>
            <p className="text-white/60">Controle global e visão de todas as instâncias do sistema.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-4">Visão Global Ativada</h3>
            <p className="text-white/60 text-sm mb-6">
              Como Super Admin, as políticas de segurança (RLS) permitem que você visualize dados de qualquer workspace.
            </p>
            <div className="p-4 bg-white/5 rounded-xl border border-white/10">
              <span className="text-xs uppercase tracking-widest font-bold text-white/40 block mb-1">Workspace Ativo (Simulado)</span>
              <code className="text-purple-400 text-sm">{activeWorkspaceId || "Nenhum selecionado"}</code>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
