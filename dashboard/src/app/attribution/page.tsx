
import DashboardLayout from "../dashboard-layout";
import { getActiveWorkspaceId } from "@/lib/workspace-session";
import { createClient } from "@/lib/supabase-server";
import { TrendingUp, ArrowLeftRight } from "lucide-react";

export default async function AttributionPage() {
  const workspaceId = await getActiveWorkspaceId();
  const supabase = await createClient();

  if (!workspaceId) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center text-white/50">Nenhum workspace selecionado.</div>
      </DashboardLayout>
    );
  }

  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  // Fetch model comparison data
  const { data: comparison } = await supabase.rpc("fn_attribution_report", {
    p_workspace_id: workspaceId,
    p_date_from: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    p_date_to: new Date(now).toISOString().slice(0, 10),
  });

  interface AttributionRow {
    campaign_name: string;
    fc_revenue: number;
    lc_revenue: number;
    total_spend: number;
  }
  const report: AttributionRow[] = (comparison as AttributionRow[]) || [];

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 max-w-6xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Análise de Atribuição</h1>
          <p className="text-white/50">Compare o desempenho das campanhas entre diferentes modelos de atribuição.</p>
        </div>

        {/* Comparison Table */}
        <div className="bg-[#121214] border border-white/5 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-white/5 flex items-center gap-3">
            <ArrowLeftRight className="w-5 h-5 text-blue-500" />
            <h3 className="font-bold text-white">Primeiro Clique vs Último Clique</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="px-6 py-4 font-bold text-white/40 uppercase tracking-widest text-[10px]">Campanha</th>
                  <th className="px-6 py-4 font-bold text-white/40 uppercase tracking-widest text-[10px]">Primeiro Clique (R$)</th>
                  <th className="px-6 py-4 font-bold text-white/40 uppercase tracking-widest text-[10px]">Último Clique (R$)</th>
                  <th className="px-6 py-4 font-bold text-white/40 uppercase tracking-widest text-[10px]">Investimento (R$)</th>
                  <th className="px-6 py-4 font-bold text-white/40 uppercase tracking-widest text-[10px]">ROAS (LC)</th>
                  <th className="px-6 py-4 font-bold text-white/40 uppercase tracking-widest text-[10px]">Diferença</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {report.map((row, i) => {
                  const diff = (row.lc_revenue || 0) - (row.fc_revenue || 0);
                  const diffPerc = row.fc_revenue > 0 ? (diff / row.fc_revenue) * 100 : 0;
                  
                  return (
                    <tr key={i} className="hover:bg-white/[0.01] transition-colors">
                      <td className="px-6 py-4 font-medium text-white">{row.campaign_name || "Direto / Desconhecido"}</td>
                      <td className="px-6 py-4 text-white/60">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.fc_revenue || 0)}
                      </td>
                      <td className="px-6 py-4 text-white/60 font-bold">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.lc_revenue || 0)}
                      </td>
                      <td className="px-6 py-4 text-white/60">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.total_spend || 0)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded bg-green-500/10 text-green-500 font-bold">
                          {((row.lc_revenue || 0) / (row.total_spend || 1)).toFixed(2)}x
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`font-medium ${diff >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {diff >= 0 ? '+' : ''}{diffPerc.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Insight Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-white/5 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              <h3 className="font-bold text-white">Insight de Atribuição</h3>
            </div>
            <p className="text-sm text-white/70 leading-relaxed">
              Campanhas com receita de <strong>Primeiro Clique</strong> significativamente maior que o <strong>Último Clique</strong> são excelentes para descoberta de novos clientes (Top of Funnel). 
              Já campanhas com foco em LC são motores de conversão direta.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
