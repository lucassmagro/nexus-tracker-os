"use client";

import type { AttributedConversion } from "@/lib/types";

interface Props { data: AttributedConversion[] }

const SOURCE_COLORS: Record<string, string> = {
  google: "#3b82f6",
  meta:   "#ec4899",
};

export default function ConversionsTable({ data }: Props) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
      <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Conversões Recentes</h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--foreground-muted)" }}>Últimos pedidos atribuídos</p>
        </div>
        <span className="text-xs font-medium px-2.5 py-1 rounded-md" style={{ background: "var(--accent-muted)", color: "var(--accent)" }}>
          {data.length} pedidos
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              {["ID do Pedido", "Valor", "Modelo", "Campanha", "Origem", "Hora"].map((h) => (
                <th key={h} className="px-6 py-3 text-left text-xs font-medium tracking-wide uppercase" style={{ color: "var(--foreground-muted)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr
                key={row.id}
                className="transition-colors"
                style={{ borderBottom: "1px solid var(--border-subtle)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <td className="px-6 py-3.5 font-mono text-xs" style={{ color: "var(--foreground)" }}>{row.orderId}</td>
                <td className="px-6 py-3.5 font-semibold" style={{ color: "var(--success)" }}>
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(row.value)}
                </td>
                <td className="px-6 py-3.5">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-md" style={{
                    background: row.model === "Last-Click" ? "var(--info-muted)" : "var(--warning-muted)",
                    color: row.model === "Last-Click" ? "var(--info)" : "var(--warning)",
                  }}>
                    {row.model}
                  </span>
                </td>
                <td className="px-6 py-3.5 text-xs max-w-[200px] truncate" style={{ color: "var(--foreground-dim)" }}>{row.campaign}</td>
                <td className="px-6 py-3.5">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                    <span className="w-2 h-2 rounded-full" style={{ background: SOURCE_COLORS[row.source] || "var(--foreground-muted)" }} />
                    <span style={{ color: "var(--foreground-dim)" }}>{row.source}</span>
                  </span>
                </td>
                <td className="px-6 py-3.5 text-xs" style={{ color: "var(--foreground-muted)" }}>
                  {new Date(row.timestamp).toLocaleString("pt-BR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
