"use client";

import { Building2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function WorkspaceCardClient({ workspace }: { workspace: any }) {
  const router = useRouter();

  const handleSelectWorkspace = () => {
    // 1. Set the cookie client-side
    document.cookie = `active_workspace_id=${workspace.id}; path=/; max-age=${60 * 60 * 24 * 30}`;
    // 2. Refresh server components
    router.refresh();
    // 3. Navigate
    router.push("/");
  };

  return (
    <button
      onClick={handleSelectWorkspace}
      type="button"
      className="w-full text-left bg-[#121214] border border-white/5 hover:border-blue-500/50 rounded-2xl p-6 transition-all shadow-xl group"
    >
      <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mb-6 group-hover:bg-blue-500/10 transition-colors">
        <Building2 className="w-6 h-6 text-white/40 group-hover:text-blue-500 transition-colors" />
      </div>
      <h3 className="text-xl font-bold text-white mb-1">{workspace.name}</h3>
      <p className="text-white/40 text-sm">Criado em {new Date(workspace.created_at).toLocaleDateString('pt-BR')}</p>
    </button>
  );
}
