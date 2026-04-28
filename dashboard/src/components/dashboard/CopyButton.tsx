"use client";

import { useState } from "react";
import { Copy, CheckCircle2 } from "lucide-react";

import { toast } from "sonner";

export default function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success("Copiado para a área de transferência!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button 
      onClick={copy}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-white/60 transition-all border border-white/5"
    >
      {copied ? (
        <>
          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
          <span className="text-green-500">Copiado!</span>
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          <span>Copiar</span>
        </>
      )}
    </button>
  );
}
