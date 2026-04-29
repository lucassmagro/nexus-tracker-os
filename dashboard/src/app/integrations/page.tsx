
import DashboardLayout from "../dashboard-layout";
import { ShoppingBag, Globe, Shield, Code2 } from "lucide-react";
import { getActiveWorkspaceId } from "@/lib/workspace-session";
import { createClient } from "@/lib/supabase-server";
import CopyButton from "@/components/dashboard/CopyButton";

export default async function IntegrationsPage() {
  const workspaceId = await getActiveWorkspaceId();
  const supabase = await createClient();

  if (!workspaceId) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center text-white/50">Nenhum workspace selecionado.</div>
      </DashboardLayout>
    );
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .single();

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : 'http://localhost:3000');

  const trackingSnippet = `<script src="${baseUrl}/tracker.js" defer></script>
<script>
  window.nexus = window.nexus || function() { (window.nexus.q = window.nexus.q || []).push(arguments) };
  window.nexus('init', '${workspaceId}');
</script>`;

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 max-w-5xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Integrações</h1>
          <p className="text-white/50">Conecte suas fontes de tráfego e plataformas de e-commerce.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Shopify Integration */}
          <div className="bg-[#121214] border border-white/5 rounded-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <h3 className="font-bold text-white">Shopify</h3>
                  <p className="text-[10px] text-green-500 uppercase tracking-widest font-bold">Conectado</p>
                </div>
              </div>
              <button className="text-xs text-white/40 hover:text-white transition-colors">Configurar</button>
            </div>
            <div className="p-6 space-y-4 flex-1">
              <div className="space-y-1">
                <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Domínio da Loja</p>
                <p className="text-sm text-white/70">{workspace?.shopify_store_url || "loja-exemplo.myshopify.com"}</p>
              </div>
              <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold mb-2">Status do Webhook</p>
                <div className="flex items-center gap-2 text-green-500">
                  <Shield className="w-4 h-4" />
                  <span className="text-xs font-medium">Verificado e Ativo</span>
                </div>
              </div>
            </div>
          </div>

          {/* Ad Platforms */}
          <div className="bg-[#121214] border border-white/5 rounded-2xl overflow-hidden flex flex-col opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-not-allowed">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Globe className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-bold text-white">Meta Ads</h3>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Em breve</p>
                </div>
              </div>
              <button disabled className="text-xs text-white/20">Conectar</button>
            </div>
            <div className="p-6 flex items-center justify-center flex-1 italic text-white/20 text-sm text-center">
              A importação automática de custos via API da Meta estará disponível em breve.
            </div>
          </div>
        </div>

        {/* Tracking Code Section */}
        <div className="bg-[#121214] border border-white/5 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Code2 className="w-5 h-5 text-blue-500" />
              <h3 className="font-bold text-white">Pixel de Rastreio</h3>
            </div>
            <CopyButton content={trackingSnippet} />
          </div>
          <div className="p-6 space-y-4">
            <p className="text-sm text-white/50 leading-relaxed">
              Instale este código no <code>&lt;head&gt;</code> de todas as páginas do seu site para começar a capturar dados de atribuição.
            </p>
            <div className="bg-[#0a0a0b] p-4 rounded-xl border border-white/5">
              <pre className="text-[11px] text-blue-400/80 font-mono overflow-x-auto whitespace-pre">
                {trackingSnippet}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
