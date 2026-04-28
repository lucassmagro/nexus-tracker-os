import DashboardLayout from "./dashboard-layout";
import { getMetrics, getRoasTimeSeries, getRecentConversions } from "@/lib/queries";
import MetricCard from "@/components/dashboard/MetricCard";
import RoasChart from "@/components/dashboard/RoasChart";
import ConversionsTable from "@/components/dashboard/ConversionsTable";


export default async function OverviewPage() {
  const [metrics, roasData, conversions] = await Promise.all([
    getMetrics(),
    getRoasTimeSeries(),
    getRecentConversions(),
  ]);

  const hasConversions = conversions.length > 0;
  
  // Check if it's truly empty (0 conversions and 0 spend in metrics)
  // Metrics: [ROAS, Receita, Investimento, Conversões]
  const isTrulyEmpty = !hasConversions && 
    metrics.find(m => m.label === "Conversões")?.value === "0" && 
    metrics.find(m => m.label === "Investimento Total")?.value === "R$ 0,00";

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        {isTrulyEmpty ? (
          <FullEmptyState />
        ) : (
          <>
            {/* ── Metric Cards ────────────────────────────────────── */}
            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {metrics.map((m) => (
                <MetricCard key={m.label} data={m} />
              ))}
            </section>

            {/* ── ROAS Chart ──────────────────────────────────────── */}
            <section>
              <RoasChart data={roasData} />
            </section>

            {/* ── Conversions Table ─────────────────────────────── */}
            <section>
              <ConversionsTable data={conversions} />
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

/** Shown when the workspace is completely empty (no conversions and no spend). */
function FullEmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-[60vh] rounded-2xl p-12 text-center"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-subtle)",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)"
      }}
    >
      <div
        className="w-24 h-24 mx-auto mb-8 rounded-full flex items-center justify-center shadow-lg"
        style={{ background: "var(--accent-muted)", border: "1px solid rgba(109, 93, 252, 0.3)" }}
      >
        <svg
          className="w-12 h-12"
          style={{ color: "var(--accent)" }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605"
          />
        </svg>
      </div>
      <h3
        className="text-3xl font-bold mb-4"
        style={{ color: "var(--foreground)" }}
      >
        Aguardando Dados...
      </h3>
      <p className="text-lg max-w-xl mx-auto mb-10" style={{ color: "var(--foreground-muted)" }}>
        Parece que esta empresa ainda não tem tráfego. Instale o pixel de rastreamento no head do seu site e configure o Webhook da Shopify para começar a mapear as conversões e descobrir o verdadeiro ROAS das suas campanhas.
      </p>

      <div className="flex gap-4">
        <a 
          href="/settings"
          className="px-8 py-3 rounded-xl font-semibold transition-all hover:scale-105"
          style={{ background: "var(--accent)", color: "#fff", boxShadow: "0 0 20px rgba(109, 93, 252, 0.4)" }}
        >
          Ver Instruções de Instalação
        </a>
      </div>
    </div>
  );
}
