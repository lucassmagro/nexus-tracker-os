import { createClient } from "@/lib/supabase-server";
import { getActiveWorkspaceId } from "@/lib/workspace-session";
import { 
  Building2, 
  Code2, 
  ShoppingBag, 
  ShieldCheck,
  Zap,
  Globe
} from "lucide-react";
import CopyButton from "@/components/dashboard/CopyButton";
import ResetSecretButton from "@/components/dashboard/ResetSecretButton";
import DashboardLayout from "../dashboard-layout";

export default async function SettingsPage() {
  const workspaceId = await getActiveWorkspaceId();
  const supabase = await createClient();
  
  if (!workspaceId) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center text-white/50">Nenhum workspace selecionado.</div>
      </DashboardLayout>
    );
  }

  // Get Workspace info
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .single();

  // Get Page Views in last 24h
  // eslint-disable-next-line react-hooks/purity
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: pageViews24h } = await supabase
    .from("page_views")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .gte("created_at", oneDayAgo);

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 
    (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : 'http://localhost:3000');

  const trackingSnippet = `<!-- Nexus Tracker -->
<script src="${baseUrl}/tracker.js" defer></script>
<script>
  window.nexus = window.nexus || function() {(window.nexus.q = window.nexus.q || []).push(arguments)};
  window.nexus('init', '${workspaceId}');
</script>`;

  const webhookUrl = `${baseUrl}/webhooks/shopify/${workspaceId}/order`;

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Central de Controle</h1>
          <p className="text-white/50">Gerencie seu workspace, rastreamento e integrações.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Zap className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-white/40 uppercase tracking-widest font-bold">Tráfego ao Vivo</p>
              <p className="text-2xl font-bold text-white">{pageViews24h || 0} <span className="text-sm font-normal text-white/40 ml-1">Vistas (24h)</span></p>
            </div>
          </div>

          <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-white/40 uppercase tracking-widest font-bold">Status</p>
              <p className="text-2xl font-bold text-white">Ativo</p>
            </div>
          </div>

          <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <p className="text-xs text-white/40 uppercase tracking-widest font-bold">Workspace</p>
              <p className="text-lg font-bold text-white truncate max-w-[150px]">{workspace?.name || "Desconhecido"}</p>
            </div>
          </div>
        </div>

        {/* Workspace Config */}
        <div className="space-y-6">
          {/* Tracking Pixel */}
          <div className="bg-[#121214] border border-white/5 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Code2 className="w-5 h-5 text-blue-500" />
                <h3 className="font-bold text-white">Pixel de Rastreio</h3>
              </div>
              <CopyButton content={trackingSnippet} />
            </div>
            <div className="p-6 bg-[#0a0a0b]/50">
              <pre className="text-xs text-white/50 font-mono overflow-x-auto whitespace-pre">
                {trackingSnippet}
              </pre>
            </div>
          </div>

          {/* Shopify Integration */}
          <div className="bg-[#121214] border border-white/5 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-white/5">
              <div className="flex items-center gap-3 mb-1">
                <ShoppingBag className="w-5 h-5 text-green-500" />
                <h3 className="font-bold text-white">Integração Shopify</h3>
              </div>
              <p className="text-sm text-white/40">Conecte sua loja Shopify para rastrear conversões e receita.</p>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">URL da Loja</label>
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/60">
                    <Globe className="w-4 h-4" />
                    {workspace?.shopify_store_url || "Não conectada"}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Segredo do Webhook</label>
                  <div className="flex items-center justify-between gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/60">
                    <span className="font-mono truncate">{workspace?.shopify_webhook_secret || "••••••••••••••••"}</span>
                    <ResetSecretButton workspaceId={workspaceId} />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">URL do Webhook Shopify</label>
                <div className="flex items-center justify-between gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/60">
                  <span className="font-mono truncate">{webhookUrl}</span>
                  <CopyButton content={webhookUrl} />
                </div>
                <p className="text-[10px] text-white/30 italic">Copie esta URL para o Admin da Shopify → Configurações → Notificações → Criar Webhook (Pedidos/Criação).</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
