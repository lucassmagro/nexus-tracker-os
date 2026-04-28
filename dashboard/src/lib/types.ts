/**
 * Dashboard Data Types
 * ─────────────────────
 * Shared interfaces used by components and data-fetching layers.
 * Extracted from mock-data.ts so they survive the migration to live data.
 */

export interface MetricCardData {
  label: string;
  value: string;
  change: number;
  trend: "up" | "down" | "flat";
  prefix?: string;
  loading?: boolean;
}

export interface RoasTimeSeriesPoint {
  date: string;
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

/** Row shape returned by fn_attribution_report() RPC */
export interface AttributionReportRow {
  workspace_id: string;
  utm_source: string | null;
  campaign_name: string | null;
  fc_conversions: number;
  fc_revenue: number;
  lc_conversions: number;
  lc_revenue: number;
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  fc_roas: number | null;
  lc_roas: number | null;
}

