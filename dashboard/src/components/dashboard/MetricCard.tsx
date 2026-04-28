"use client";

import type { MetricCardData } from "@/lib/types";

const TREND_CONFIG = {
  up:   { color: "var(--success)", bg: "var(--success-muted)", arrow: "↑" },
  down: { color: "var(--danger)",  bg: "var(--danger-muted)",  arrow: "↓" },
  flat: { color: "var(--foreground-muted)", bg: "var(--surface-hover)", arrow: "→" },
};

interface Props {
  data: MetricCardData;
}

export default function MetricCard({ data }: Props) {
  const trend = TREND_CONFIG[data.trend];

  return (
    <div
      className="group relative rounded-xl p-5 transition-all duration-200 overflow-hidden"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-subtle)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-subtle)")}
    >
      {/* Subtle glow on hover */}
      <div
        className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-3xl"
        style={{ background: "var(--accent)" }}
      />

      <div className="relative z-10">
        <p
          className="text-xs font-medium tracking-wide uppercase mb-3"
          style={{ color: "var(--foreground-muted)" }}
        >
          {data.label}
        </p>

        <p className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
          {data.value}
        </p>

        <div className="flex items-center gap-1.5">
          <span
            className="inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-md"
            style={{ color: trend.color, background: trend.bg }}
          >
            {trend.arrow} {Math.abs(data.change)}%
          </span>
          <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>
            vs período anterior
          </span>
        </div>
      </div>
    </div>
  );
}
