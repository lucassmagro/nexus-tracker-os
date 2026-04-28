"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import type { RoasTimeSeriesPoint } from "@/lib/types";

interface Props { data: RoasTimeSeriesPoint[] }

interface TipProps {
  active?: boolean;
  payload?: Array<{ dataKey: string; color: string; value: number }>;
  label?: string;
}

function Tip({ active, payload, label }: TipProps) {
  if (!active || !payload) return null;
  return (
    <div className="rounded-lg px-4 py-3 shadow-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <p className="text-xs font-medium mb-2" style={{ color: "var(--foreground-muted)" }}>{label}</p>
      {payload.map((e) => (
        <div key={e.dataKey} className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: e.color }} />
            <span className="text-xs" style={{ color: "var(--foreground-dim)" }}>
              {e.dataKey === "reportedRoas" ? "Plataforma" : "Nexus"}
            </span>
          </div>
          <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{e.value.toFixed(2)}x</span>
        </div>
      ))}
    </div>
  );
}

export default function RoasChart({ data }: Props) {
  return (
    <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Comparação de ROAS</h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--foreground-muted)" }}>Relatado pela plataforma vs. Atribuição real Nexus</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--chart-4)" }} />
            <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>Plataforma</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--chart-1)" }} />
            <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>Nexus</span>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-4)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--chart-4)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gN" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "var(--foreground-muted)", fontSize: 11 }} tickMargin={8} interval="preserveStartEnd" />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--foreground-muted)", fontSize: 11 }} tickFormatter={(v: number) => `${v}x`} />
          <Tooltip content={<Tip />} />
          <Area type="monotone" dataKey="reportedRoas" stroke="var(--chart-4)" strokeWidth={2} fill="url(#gR)" dot={false} activeDot={{ r: 4, fill: "var(--chart-4)" }} />
          <Area type="monotone" dataKey="nexusRoas" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#gN)" dot={false} activeDot={{ r: 5, strokeWidth: 2, fill: "var(--background)", stroke: "var(--chart-1)" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
