
"use client";

import { useState } from "react";
import { ChevronDown, Building2, Check, Settings } from "lucide-react";
import { setActiveWorkspaceAction } from "@/lib/workspace-session";
import Link from "next/link";

interface Workspace {
  id: string;
  name: string;
}

export default function WorkspaceSwitcher({ 
  workspaces, 
  activeId 
}: { 
  workspaces: Workspace[], 
  activeId: string | null 
}) {
  const [open, setOpen] = useState(false);
  const activeWorkspace = workspaces.find(w => w.id === activeId) || workspaces[0];

  return (
    <div className="relative">
      <button 
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors hover:bg-white/5 group"
      >
        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-4 h-4 text-blue-500" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-xs text-white/40 uppercase tracking-widest font-bold leading-tight">Workspace</p>
          <p className="text-sm font-bold text-white truncate">{activeWorkspace?.name || "Selecionar..."}</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-white/20 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-full left-0 w-64 mt-2 z-50 bg-[#1a1a1c] border border-white/10 rounded-xl shadow-2xl overflow-hidden py-1">
            <p className="px-4 py-2 text-[10px] uppercase tracking-widest font-bold text-white/30">Seus Workspaces</p>
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => {
                  setActiveWorkspaceAction(ws.id);
                  setOpen(false);
                }}
                className="w-full flex items-center justify-between px-4 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors"
              >
                <span className="truncate">{ws.name}</span>
                {ws.id === activeWorkspace?.id && <Check className="w-4 h-4 text-blue-500" />}
              </button>
            ))}
            <div className="border-t border-white/5 mt-1 pt-1">
              <Link
                href="/workspaces"
                onClick={() => setOpen(false)}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-blue-400 hover:bg-white/5 hover:text-blue-300 transition-colors"
              >
                <Settings className="w-4 h-4" />
                Gerenciar Empresas
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
