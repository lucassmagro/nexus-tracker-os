"use client";

import { useState } from "react";
import { RefreshCcw, Loader2 } from "lucide-react";
import { resetShopifySecretAction } from "@/lib/actions";

export default function ResetSecretButton({ workspaceId }: { workspaceId: string }) {
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!confirm("Tem certeza? Isso irá interromper sua integração de webhook da Shopify até que você atualize o segredo no Admin da Shopify.")) return;
    
    setLoading(true);
    await resetShopifySecretAction(workspaceId);
    setLoading(false);
  };

  return (
    <button 
      onClick={handleReset}
      disabled={loading}
      className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors"
      title="Redefinir Segredo"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <RefreshCcw className="w-4 h-4" />
      )}
    </button>
  );
}
