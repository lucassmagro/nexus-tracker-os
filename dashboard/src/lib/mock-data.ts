/**
 * Mock Data for Dashboard Development
 * ─────────────────────────────────────
 * Realistic data used by Server Components before Supabase is wired up.
 * Replace each function with a real Supabase query when ready.
 */

// ── Types ─────────────────────────────────────────────────────────────
export interface MetricCardData {
  label: string;
  value: string;
  change: number;      // percentage change vs. previous period
  trend: "up" | "down" | "flat";
  prefix?: string;
}

export interface RoasTimeSeriesPoint {
  date: string;        // "Apr 01"
  reportedRoas: number;
  nexusRoas: number;
}

export interface AttributedConversion {
  id: string;
  orderId: string;
  value: number;
  currency: string;
  model: "First-Click" | "Last-Click";
  campaign: string;
  source: string;
  timestamp: string;
}

// ── Metric Cards ──────────────────────────────────────────────────────
export async function getMetrics(): Promise<MetricCardData[]> {
  // Simulate async delay
  await delay(80);

  return [
    {
      label: "True ROAS",
      value: "4.2x",
      change: 12.5,
      trend: "up",
    },
    {
      label: "Influenced Revenue",
      value: "$128,450",
      change: 8.3,
      trend: "up",
      prefix: "$",
    },
    {
      label: "Total Ad Spend",
      value: "$30,580",
      change: -3.2,
      trend: "down",
      prefix: "$",
    },
    {
      label: "Conversions",
      value: "1,247",
      change: 15.7,
      trend: "up",
    },
  ];
}

// ── ROAS Time Series ──────────────────────────────────────────────────
export async function getRoasTimeSeries(): Promise<RoasTimeSeriesPoint[]> {
  await delay(100);

  const days = [
    "Apr 01", "Apr 02", "Apr 03", "Apr 04", "Apr 05", "Apr 06", "Apr 07",
    "Apr 08", "Apr 09", "Apr 10", "Apr 11", "Apr 12", "Apr 13", "Apr 14",
    "Apr 15", "Apr 16", "Apr 17", "Apr 18", "Apr 19", "Apr 20", "Apr 21",
    "Apr 22", "Apr 23", "Apr 24", "Apr 25", "Apr 26", "Apr 27", "Apr 28",
  ];

  return days.map((date) => ({
    date,
    reportedRoas: +(2.5 + Math.random() * 3.5).toFixed(2),
    nexusRoas:    +(1.8 + Math.random() * 3.0).toFixed(2),
  }));
}

// ── Attributed Conversions Table ──────────────────────────────────────
export async function getRecentConversions(): Promise<AttributedConversion[]> {
  await delay(120);

  return [
    {
      id: "cv_001",
      orderId: "ORD-84721",
      value: 349.90,
      currency: "USD",
      model: "Last-Click",
      campaign: "google_pmax_all_products",
      source: "google",
      timestamp: "2026-04-28T10:23:00Z",
    },
    {
      id: "cv_002",
      orderId: "ORD-84719",
      value: 129.00,
      currency: "USD",
      model: "First-Click",
      campaign: "meta_lookalike_top_purchasers",
      source: "meta",
      timestamp: "2026-04-28T09:45:00Z",
    },
    {
      id: "cv_003",
      orderId: "ORD-84715",
      value: 89.90,
      currency: "USD",
      model: "Last-Click",
      campaign: "meta_retargeting_cart_abandoners",
      source: "meta",
      timestamp: "2026-04-28T08:12:00Z",
    },
    {
      id: "cv_004",
      orderId: "ORD-84710",
      value: 549.00,
      currency: "USD",
      model: "First-Click",
      campaign: "google_search_brand_terms",
      source: "google",
      timestamp: "2026-04-27T22:37:00Z",
    },
    {
      id: "cv_005",
      orderId: "ORD-84708",
      value: 199.90,
      currency: "USD",
      model: "Last-Click",
      campaign: "meta_brand_awareness_broad",
      source: "meta",
      timestamp: "2026-04-27T20:05:00Z",
    },
    {
      id: "cv_006",
      orderId: "ORD-84703",
      value: 74.50,
      currency: "USD",
      model: "Last-Click",
      campaign: "google_display_remarketing",
      source: "google",
      timestamp: "2026-04-27T18:14:00Z",
    },
    {
      id: "cv_007",
      orderId: "ORD-84699",
      value: 420.00,
      currency: "USD",
      model: "First-Click",
      campaign: "meta_lookalike_top_purchasers",
      source: "meta",
      timestamp: "2026-04-27T15:50:00Z",
    },
    {
      id: "cv_008",
      orderId: "ORD-84695",
      value: 159.90,
      currency: "USD",
      model: "Last-Click",
      campaign: "google_pmax_all_products",
      source: "google",
      timestamp: "2026-04-27T13:28:00Z",
    },
  ];
}

// ── Helpers ───────────────────────────────────────────────────────────
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
