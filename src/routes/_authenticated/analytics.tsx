import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingDown, TrendingUp } from "lucide-react";

import { AppShell, SectionCard } from "@/components/app-shell";
import { RiskBadge } from "@/components/risk-badge";
import { historyQuery, locationsQuery } from "@/lib/api";
import { useProfile } from "@/hooks/use-profile";
import { formatDateTime, riskHex, riskLevel } from "@/lib/risk";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Reports & Analytics — LandslideGuard" },
      {
        name: "description",
        content:
          "Risk distribution, rainfall trends and top high-risk areas across the North Eastern Region of India.",
      },
      { property: "og:title", content: "Reports & Analytics — LandslideGuard" },
      {
        property: "og:description",
        content: "Landslide risk analytics and trends for NE India.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { data: profile } = useProfile();
  const { data: locations = [] } = useQuery(locationsQuery);
  const { data: history = [] } = useQuery(historyQuery);

  const distribution = (["low", "moderate", "high", "critical"] as const).map((level) => ({
    name: level[0]!.toUpperCase() + level.slice(1),
    value: locations.filter((l) => riskLevel(l.risk_score) === level).length,
    color: riskHex[level],
  }));

  const days = Array.from(new Set(history.map((h) => h.recorded_on))).sort();
  const rainfallTrend = days.map((day) => {
    const rows = history.filter((h) => h.recorded_on === day);
    return {
      date: new Date(day).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      rainfall: Math.round(rows.reduce((s, r) => s + r.rainfall, 0) / Math.max(1, rows.length)),
      score: Number(
        (rows.reduce((s, r) => s + r.risk_score, 0) / Math.max(1, rows.length)).toFixed(2),
      ),
    };
  });

  const top5 = [...locations].sort((a, b) => b.risk_score - a.risk_score).slice(0, 5);

  return (
    <AppShell
      title="Reports & Analytics"
      subtitle="Risk distribution, rainfall patterns and regional trends"
      user={profile ? { name: profile.name, role: profile.roleLabel } : null}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_1.4fr]">
        <SectionCard title="Risk Distribution" description={`${locations.length} monitored areas`}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={distribution} dataKey="value" nameKey="name" innerRadius={58} outerRadius={90} paddingAngle={2}>
                  {distribution.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Rainfall Trend" description="Regional average rainfall, last 7 days">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rainfallTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} unit=" mm" width={55} />
                <Tooltip />
                <Bar dataKey="rainfall" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <SectionCard className="mt-4" title="Risk Trend (Overall)" description="Average regional risk score">
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rainfallTrend}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 1]} fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip />
              <Line type="monotone" dataKey="score" stroke={riskHex.high} strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <SectionCard className="mt-4" title="Top 5 High Risk Areas">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-3 font-medium">#</th>
                <th className="pb-2 pr-3 font-medium">Location</th>
                <th className="pb-2 pr-3 font-medium">Risk Level</th>
                <th className="pb-2 pr-3 font-medium">Score</th>
                <th className="pb-2 pr-3 font-medium">Trend</th>
                <th className="pb-2 font-medium">Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {top5.map((loc, i) => {
                const rows = history
                  .filter((h) => h.location_id === loc.id)
                  .sort((a, b) => a.recorded_on.localeCompare(b.recorded_on));
                const rising = (rows.at(-1)?.risk_score ?? 0) >= (rows[0]?.risk_score ?? 0);
                return (
                  <tr key={loc.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5 pr-3 text-muted-foreground">{i + 1}</td>
                    <td className="py-2.5 pr-3 font-medium text-foreground">
                      <Link to="/risk/$id" params={{ id: loc.id }} className="hover:underline">
                        {loc.name}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-3">
                      <RiskBadge score={loc.risk_score} />
                    </td>
                    <td className="py-2.5 pr-3 font-semibold text-foreground">
                      {loc.risk_score.toFixed(2)}
                    </td>
                    <td className="py-2.5 pr-3">
                      {rising ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-risk-critical">
                          <TrendingUp className="h-3.5 w-3.5" /> Rising
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-medium text-risk-low">
                          <TrendingDown className="h-3.5 w-3.5" /> Falling
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-xs text-muted-foreground">
                      {formatDateTime(loc.updated_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </AppShell>
  );
}
