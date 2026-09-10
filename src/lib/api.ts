import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import {
  DEMO_ALERTS,
  DEMO_HISTORY,
  DEMO_LOCATIONS,
  DEMO_REPORTS,
  DEMO_SOURCES,
  type AlertRow,
  type DataSourceRow,
  type FieldReportRow,
  type HistoryRow,
  type LocationRow,
} from "./demo-data";

/** Runs a live query but never lets a slow/failed network break the demo. */
async function withFallback<T>(run: () => Promise<T[] | null>, fallback: T[]): Promise<T[]> {
  try {
    const rows = await run();
    if (!rows || rows.length === 0) return fallback;
    return rows;
  } catch {
    return fallback;
  }
}

const num = (v: unknown) => Number(v ?? 0);

export const locationsQuery = queryOptions({
  queryKey: ["risk_locations"],
  staleTime: 30_000,
  queryFn: async (): Promise<LocationRow[]> =>
    withFallback(async () => {
      const { data, error } = await supabase
        .from("risk_locations")
        .select("*")
        .order("risk_score", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        risk_score: num(r.risk_score),
        rainfall_24h: num(r.rainfall_24h),
        soil_moisture: num(r.soil_moisture),
        slope_angle: num(r.slope_angle),
        elevation: num(r.elevation),
      })) as LocationRow[];
    }, DEMO_LOCATIONS),
});

export const alertsQuery = queryOptions({
  queryKey: ["alerts"],
  staleTime: 10_000,
  queryFn: async (): Promise<AlertRow[]> =>
    withFallback(async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({ ...r, risk_score: num(r.risk_score) })) as AlertRow[];
    }, DEMO_ALERTS),
});

export const reportsQuery = queryOptions({
  queryKey: ["field_reports"],
  staleTime: 10_000,
  queryFn: async (): Promise<FieldReportRow[]> =>
    withFallback(async () => {
      const { data, error } = await supabase
        .from("field_reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as FieldReportRow[];
    }, DEMO_REPORTS),
});

export const historyQuery = queryOptions({
  queryKey: ["risk_history"],
  staleTime: 60_000,
  queryFn: async (): Promise<HistoryRow[]> =>
    withFallback(async () => {
      const { data, error } = await supabase
        .from("risk_history")
        .select("*")
        .order("recorded_on", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        risk_score: num(r.risk_score),
        rainfall: num(r.rainfall),
      })) as HistoryRow[];
    }, DEMO_HISTORY),
});

export const dataSourcesQuery = queryOptions({
  queryKey: ["data_sources"],
  staleTime: 60_000,
  queryFn: async (): Promise<DataSourceRow[]> =>
    withFallback(async () => {
      const { data, error } = await supabase.from("data_sources").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as unknown as DataSourceRow[];
    }, DEMO_SOURCES),
});
