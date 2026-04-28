"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Building2, 
  Code2, 
  ShoppingBag, 
  CheckCircle2, 
  Copy, 
  ChevronRight, 
  Loader2,
  ArrowRight,
  ExternalLink
} from "lucide-react";
import { createWorkspaceAction } from "@/lib/actions";
import { useRouter } from "next/navigation";

import { toast } from "sonner";

export default function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    shopifyUrl: "",
  });
  const [workspace, setWorkspace] = useState<Record<string, unknown> | null>(null);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  const handleCreateWorkspace = async (data: FormData) => {
    setLoading(true);
    
    // Add the name from state since it was unmounted in step 1
    if (!data.has("name")) {
      data.append("name", formData.name);
    }

    const result = await createWorkspaceAction(data);
    if (result.success) {
      setWorkspace(result.workspace as Record<string, unknown>);
      
      // Set the newly created workspace as active
      if (result.workspace && typeof result.workspace === 'object' && 'id' in result.workspace) {
        document.cookie = `active_workspace_id=${String(result.workspace.id)}; path=/`;
      }

      setStep(3);
      toast.success("Empresa criada com sucesso!");
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  };

  const trackingSnippet = workspace ? `<!-- Nexus Tracker -->
<script src="http://localhost:3000/tracker.js" defer></script>
<script>
  window.nexus = window.nexus || function() {(window.nexus.q = window.nexus.q || []).push(arguments)};
  window.nexus('init', '${String(workspace.id)}');
</script>` : "";

  const copyToClipboard = () => {
    navigator.clipboard.writeText(trackingSnippet);
    setCopied(true);
    toast.success("Snippet copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const steps = [
    { id: 1, title: "Dados do Negócio", icon: Building2 },
    { id: 2, title: "Integrações", icon: ShoppingBag },
    { id: 3, title: "Instalação", icon: Code2 },
    { id: 4, title: "Pronto", icon: CheckCircle2 },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0b] p-6">
      {/* Background Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-blue-500/10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-purple-500/10 blur-[120px] rounded-full" />
      </div>

      <div className="w-full max-w-xl relative">
        {/* Progress Bar */}
        <div className="flex justify-between mb-12 relative">
          <div className="absolute top-1/2 left-0 w-full h-[1px] bg-white/5 -translate-y-1/2 z-0" />
          <div 
            className="absolute top-1/2 left-0 h-[1px] bg-blue-500 transition-all duration-500 -translate-y-1/2 z-0" 
            style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}
          />
          
          {steps.map((s) => (
            <div 
              key={s.id}
              className={`relative z-10 flex flex-col items-center gap-2 ${step >= s.id ? 'text-white' : 'text-white/20'}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                step === s.id ? 'bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5)]' : 
                step > s.id ? 'bg-blue-500' : 'bg-[#1a1a1c] border border-white/5'
              }`}>
                <s.icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] uppercase tracking-widest font-bold text-center leading-tight">{s.title}</span>
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-[#121214] border border-white/5 rounded-3xl p-8 shadow-2xl backdrop-blur-xl"
          >
            {step === 1 && (
              <form onSubmit={(e) => { e.preventDefault(); setStep(2); }} className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Nomeie seu negócio</h2>
                  <p className="text-white/50 text-sm mb-8">Este será o nome do seu workspace.</p>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-wider text-white/40 font-bold ml-1">Nome do Workspace</label>
                      <input 
                        name="name"
                        required
                        placeholder="Ex: Acme Atribuição"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500/50 transition-colors"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-white text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-white/90 transition-colors"
                >
                  Continuar <ChevronRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {step === 2 && (
              <form action={handleCreateWorkspace} className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Conectar Shopify</h2>
                  <p className="text-white/50 text-sm mb-8">Opcionalmente conecte sua loja agora ou pule para depois.</p>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-wider text-white/40 font-bold ml-1">URL da Loja</label>
                      <input 
                        name="shopifyUrl"
                        placeholder="minha-loja.myshopify.com"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500/50 transition-colors"
                        value={formData.shopifyUrl}
                        onChange={(e) => setFormData({ ...formData, shopifyUrl: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 border border-white/10 text-white font-bold py-4 rounded-xl hover:bg-white/5 transition-colors"
                  >
                    Voltar
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-[2] bg-white text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-white/90 transition-colors disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Finalizar Configuração <ChevronRight className="w-4 h-4" /></>}
                  </button>
                </div>
              </form>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Instalar Pixel de Rastreio</h2>
                  <p className="text-white/50 text-sm mb-8">Copie e cole este snippet na tag <code className="text-blue-400">&lt;head&gt;</code> do seu site.</p>
                  
                  <div className="relative group">
                    <pre className="bg-[#0a0a0b] border border-white/10 rounded-xl p-4 text-[13px] text-white/70 overflow-x-auto font-mono leading-relaxed">
                      {trackingSnippet}
                    </pre>
                    <button 
                      onClick={copyToClipboard}
                      className="absolute top-3 right-3 bg-white/10 hover:bg-white/20 p-2 rounded-lg backdrop-blur-md transition-colors"
                    >
                      {copied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex gap-4">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <ExternalLink className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="text-sm">
                    <p className="text-white font-medium mb-1">Testando Instalação</p>
                    <p className="text-white/40">Uma vez instalado, atualize sua loja e você verá as visualizações de página aparecerem em tempo real.</p>
                  </div>
                </div>

                <button 
                  onClick={() => setStep(4)}
                  className="w-full bg-blue-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors"
                >
                  Próximo Passo <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {step === 4 && (
              <div className="text-center py-8 space-y-8">
                <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto shadow-[0_0_50px_rgba(34,197,94,0.2)]">
                  <CheckCircle2 className="w-12 h-12 text-green-500" />
                </div>
                
                <div>
                  <h2 className="text-3xl font-bold mb-4">Tudo pronto!</h2>
                  <p className="text-white/50 text-lg">Seu workspace <span className="text-white font-bold">&quot;{String(workspace?.name || '')}&quot;</span> está pronto para começar o rastreio.</p>
                </div>

                <button 
                  onClick={() => router.push("/")}
                  className="w-full bg-white text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-white/90 transition-colors"
                >
                  Ir para o Dashboard <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
