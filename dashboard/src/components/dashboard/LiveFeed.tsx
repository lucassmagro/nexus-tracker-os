"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-client";
import { motion, AnimatePresence } from "framer-motion";
import { Globe2, MousePointerClick, CheckCircle2, AlertCircle } from "lucide-react";

interface LiveEvent {
  id: string;
  type: "page_view" | "conversion";
  source: string;
  campaign: string;
  location: string;
  timestamp: string;
  value?: number;
}

export default function LiveFeed({ activeWorkspaceId }: { activeWorkspaceId: string }) {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    // Initial max events to keep in memory
    const MAX_EVENTS = 50;

    const channel = supabase.channel("realtime_traffic")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "page_views",
          filter: `workspace_id=eq.${activeWorkspaceId}`,
        },
        (payload) => {
          const newEvent: LiveEvent = {
            id: payload.new.id,
            type: "page_view",
            source: payload.new.utm_source || "Orgânico",
            campaign: payload.new.utm_campaign || "Desconhecida",
            location: payload.new.country_code || "Global",
            timestamp: payload.new.created_at,
          };
          setEvents((prev) => [newEvent, ...prev].slice(0, MAX_EVENTS));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversions",
          filter: `workspace_id=eq.${activeWorkspaceId}`,
        },
        (payload) => {
          const newEvent: LiveEvent = {
            id: payload.new.id,
            type: "conversion",
            source: "Conversão", // Conversions don't store UTM directly in this table schema
            campaign: "Pedido " + payload.new.order_id,
            location: "N/A",
            timestamp: payload.new.created_at,
            value: Number(payload.new.value),
          };
          setEvents((prev) => [newEvent, ...prev].slice(0, MAX_EVENTS));
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setIsConnected(true);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeWorkspaceId, supabase]);

  const getTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 10000) return "Agora mesmo";
    if (diff < 60000) return "Menos de 1 min";
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `Há ${mins} min`;
    const hours = Math.floor(mins / 60);
    return `Há ${hours} hora${hours > 1 ? 's' : ''}`;
  };

  return (
    <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 shadow-xl relative overflow-hidden min-h-[400px]">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-white">Eventos Recentes</h3>
        <div className="flex items-center gap-2">
          {isConnected ? (
             <span className="flex items-center gap-2 text-xs font-bold text-green-400 bg-green-500/10 px-3 py-1.5 rounded-full border border-green-500/20">
               <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
               Conectado
             </span>
          ) : (
            <span className="flex items-center gap-2 text-xs font-bold text-yellow-400 bg-yellow-500/10 px-3 py-1.5 rounded-full border border-yellow-500/20">
               <AlertCircle className="w-3 h-3" />
               Conectando...
             </span>
          )}
        </div>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
          <Globe2 className="w-12 h-12 text-white/40 mb-4 animate-pulse" />
          <p className="text-white font-medium mb-1">Aguardando novos eventos...</p>
          <p className="text-sm text-white/60">As visitas e conversões aparecerão aqui em tempo real.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {events.map((ev) => (
              <motion.div
                key={ev.id}
                initial={{ opacity: 0, x: -20, height: 0 }}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  ev.type === 'conversion' 
                    ? 'bg-green-500/5 border-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.05)]' 
                    : 'bg-white/5 border-white/5 hover:bg-white/10'
                } transition-colors`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    ev.type === 'conversion' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/10 text-blue-400'
                  }`}>
                    {ev.type === 'conversion' ? <CheckCircle2 className="w-5 h-5" /> : <MousePointerClick className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white mb-0.5">
                      {ev.type === 'conversion' ? 'Nova Conversão' : 'Visualização de Página'}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-white/50">
                      <span className="flex items-center gap-1 font-medium text-white/70">
                        <span className="uppercase tracking-wide opacity-50">Origem:</span> {ev.source}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <span className="uppercase tracking-wide opacity-50">Campanha:</span> <span className="truncate max-w-[150px]">{ev.campaign}</span>
                      </span>
                      {ev.location && ev.location !== 'N/A' && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <span className="uppercase tracking-wide opacity-50">Local:</span> {ev.location}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-right">
                  {ev.value !== undefined && (
                    <span className="font-bold text-green-400 bg-green-500/10 px-3 py-1 rounded-lg">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(ev.value)}
                    </span>
                  )}
                  <span className="text-xs font-bold uppercase tracking-wider text-white/30 whitespace-nowrap">
                    {getTimeAgo(ev.timestamp)}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
