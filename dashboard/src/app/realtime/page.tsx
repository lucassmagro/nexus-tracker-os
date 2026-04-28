import DashboardLayout from "../dashboard-layout";
import { getActiveWorkspaceId } from "@/lib/workspace-session";
import LiveFeed from "@/components/dashboard/LiveFeed";
import { Activity } from "lucide-react";
import { redirect } from "next/navigation";

export default async function RealtimePage() {
  const activeWorkspaceId = await getActiveWorkspaceId();

  if (!activeWorkspaceId) {
    redirect("/workspaces");
  }

  return (
    <DashboardLayout>
      <div className="p-8 max-w-5xl mx-auto space-y-8">
        <div className="flex items-center gap-4 border-b border-white/5 pb-6">
          <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-xl bg-green-400 opacity-20"></span>
            <Activity className="w-6 h-6 text-green-500 relative z-10" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              Fluxo em Tempo Real
              <span className="bg-green-500/20 text-green-400 text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-md">Ao Vivo</span>
            </h1>
            <p className="text-white/60">Acompanhe visualizações de página e conversões instantaneamente.</p>
          </div>
        </div>

        <LiveFeed activeWorkspaceId={activeWorkspaceId} />
      </div>
    </DashboardLayout>
  );
}
