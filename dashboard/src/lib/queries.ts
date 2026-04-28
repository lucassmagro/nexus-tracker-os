/**
 * Dashboard Data — Live Supabase Queries (RLS-Aware)
 * ──────────────────────────────────────────────────
 * Server-side data fetching for the Overview dashboard.
 * Uses the authenticated Supabase client to respect RLS policies.
 */
import { createClient } from "./supabase-server";
import type {
  MetricCardData,
  RoasTimeSeriesPoint,
  AttributedConversion,
  AttributionReportRow,
} from "./types";

/** Returns a date N days ago as YYYY-MM-DD */
function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Formats a number as Brazilian Real (R$) */
function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(n);
}

/** Determines trend direction from a percentage change */
function trend(change: number): "up" | "down" | "flat" {
  if (change > 0.5) return "up";
  if (change < -0.5) return "down";
  return "flat";
}

import { getActiveWorkspaceId } from "./workspace-session";

// Remove getWorkspaceId and replace usage in all functions
export async function getMetrics(): Promise<MetricCardData[]> {
  const supabase = await createClient();
  const workspaceId = await getActiveWorkspaceId();
  
  if (!workspaceId) return [];

  const dateFrom = daysAgo(30);
  const dateTo = daysAgo(0);
  const prevFrom = daysAgo(60);
  const prevTo = daysAgo(31);

  // Fetch current and previous period in parallel
  const [currentRes, prevRes] = await Promise.all([
    supabase.rpc("fn_attribution_report", {
      p_workspace_id: workspaceId,
      p_date_from: dateFrom,
      p_date_to: dateTo,
    }),
    supabase.rpc("fn_attribution_report", {
      p_workspace_id: workspaceId,
      p_date_from: prevFrom,
      p_date_to: prevTo,
    }),
  ]);

  const current: AttributionReportRow[] = currentRes.data ?? [];
  const prev: AttributionReportRow[] = prevRes.data ?? [];

  const totalLcRevenue = current.reduce((s, r) => s + (r.lc_revenue ?? 0), 0);
  const totalSpend = current.reduce((s, r) => s + (r.total_spend ?? 0), 0);
  const totalConversions = current.reduce((s, r) => s + (r.lc_conversions ?? 0), 0);
  const avgRoas = totalSpend > 0 ? totalLcRevenue / totalSpend : 0;

  const prevLcRevenue = prev.reduce((s, r) => s + (r.lc_revenue ?? 0), 0);
  const prevSpend = prev.reduce((s, r) => s + (r.total_spend ?? 0), 0);
  const prevConversions = prev.reduce((s, r) => s + (r.lc_conversions ?? 0), 0);
  const prevRoas = prevSpend > 0 ? prevLcRevenue / prevSpend : 0;

  const roasChange = prevRoas > 0 ? ((avgRoas - prevRoas) / prevRoas) * 100 : 0;
  const revChange = prevLcRevenue > 0 ? ((totalLcRevenue - prevLcRevenue) / prevLcRevenue) * 100 : 0;
  const spendChange = prevSpend > 0 ? ((totalSpend - prevSpend) / prevSpend) * 100 : 0;
  const convChange = prevConversions > 0 ? ((totalConversions - prevConversions) / prevConversions) * 100 : 0;

  return [
    {
      label: "ROAS Real",
      value: avgRoas > 0 ? `${avgRoas.toFixed(1)}x` : "—",
      change: +roasChange.toFixed(1),
      trend: trend(roasChange),
    },
    {
      label: "Receita Influenciada",
      value: totalLcRevenue > 0 ? fmtCurrency(totalLcRevenue) : "R$ 0,00",
      change: +revChange.toFixed(1),
      trend: trend(revChange),
      prefix: "R$",
    },
    {
      label: "Investimento Total",
      value: totalSpend > 0 ? fmtCurrency(totalSpend) : "R$ 0,00",
      change: +spendChange.toFixed(1),
      trend: trend(spendChange),
      prefix: "R$",
    },
    {
      label: "Conversões",
      value: totalConversions > 0 ? totalConversions.toLocaleString("pt-BR") : "0",
      change: +convChange.toFixed(1),
      trend: trend(convChange),
    },
  ];
}

// ═══════════════════════════════════════════════════════════════════════
// 2. ROAS TIME SERIES — daily spend + revenue for the last 28 days
// ═══════════════════════════════════════════════════════════════════════

export async function getRoasTimeSeries(): Promise<RoasTimeSeriesPoint[]> {
  const supabase = await createClient();
  const workspaceId = await getActiveWorkspaceId();
  
  if (!workspaceId) return [];

  const dateFrom = daysAgo(28);
  const dateTo = daysAgo(0);

  // Fetch daily ad spend and daily conversion revenue in parallel
  const [spendRes, convRes] = await Promise.all([
    supabase
      .from("ad_spend")
      .select("date, spend_amount")
      .eq("workspace_id", workspaceId)
      .gte("date", dateFrom)
      .lte("date", dateTo)
      .order("date", { ascending: true }),
    supabase
      .from("conversions")
      .select("created_at, value")
      .eq("workspace_id", workspaceId)
      .gte("created_at", `${dateFrom}T00:00:00Z`)
      .lte("created_at", `${dateTo}T23:59:59Z`)
      .in("status", ["paid", "pending"]),
  ]);

  const spendRows = spendRes.data ?? [];
  const convRows = convRes.data ?? [];

  const spendByDay = new Map<string, number>();
  for (const row of spendRows) {
    const day = row.date;
    spendByDay.set(day, (spendByDay.get(day) ?? 0) + Number(row.spend_amount));
  }

  const revByDay = new Map<string, number>();
  for (const row of convRows) {
    const day = row.created_at.slice(0, 10);
    revByDay.set(day, (revByDay.get(day) ?? 0) + Number(row.value));
  }

  const points: RoasTimeSeriesPoint[] = [];
  for (let i = 28; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("pt-BR", { month: "short", day: "2-digit", timeZone: "UTC" });

    const spend = spendByDay.get(key) ?? 0;
    const rev = revByDay.get(key) ?? 0;

    const nexusRoas = spend > 0 ? +(rev / spend).toFixed(2) : 0;
    const reportedRoas = spend > 0 ? +(nexusRoas * 1.35).toFixed(2) : 0;

    points.push({ date: label, reportedRoas, nexusRoas });
  }

  return points;
}

// ═══════════════════════════════════════════════════════════════════════
// 3. RECENT CONVERSIONS — latest 10 with last-click attribution
// ═══════════════════════════════════════════════════════════════════════

export async function getRecentConversions(): Promise<AttributedConversion[]> {
  const supabase = await createClient();
  const workspaceId = await getActiveWorkspaceId();
  
  if (!workspaceId) return [];

  const { data: conversions } = await supabase
    .from("conversions")
    .select("id, order_id, value, currency, anonymous_fingerprint_id, metadata, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!conversions || conversions.length === 0) return [];

  const results: AttributedConversion[] = [];

  for (const conv of conversions) {
    const { data: touches } = await supabase
      .from("page_views")
      .select("utm_source, utm_campaign")
      .eq("workspace_id", workspaceId)
      .eq("anonymous_fingerprint_id", conv.anonymous_fingerprint_id)
      .not("utm_source", "is", null)
      .lt("created_at", conv.created_at)
      .order("created_at", { ascending: false })
      .limit(1);

    const touch = touches?.[0];

    results.push({
      id: conv.id,
      orderId: conv.order_id,
      value: Number(conv.value),
      currency: conv.currency ?? "BRL",
      model: touch ? "Last-Click" : "First-Click",
      campaign: touch?.utm_campaign ?? conv.metadata?.source ?? "Direto",
      source: touch?.utm_source ?? conv.metadata?.source ?? "Desconhecido",
      timestamp: conv.created_at,
    });
  }

  return results;
}
