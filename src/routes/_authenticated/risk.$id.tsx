import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CloudRain,
  Droplets,
  Mountain,
  TrendingUp,
  Triangle,
  Users,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell, SectionCard } from "@/components/app-shell";
import { MapPanel } from "@/components/map/map-panel";
import { RiskBadge, StatusPill } from "@/components/risk-badge";
import { Button } from "@/components/ui/button";
import { historyQuery, locationsQuery, reportsQuery } from "@/lib/api";
import { useProfile } from "@/hooks/use-profile";
import { formatDateTime, riskHex, riskLabel, riskLevel } from "@/lib/risk";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/risk/$id")({
  head: () => ({
    meta: [
      { title: "Risk Area Details — LandslideGuard" },
      {
        name: "description",
        content:
          "Detailed landslide risk analysis for a monitored area: risk score, rainfall, soil moisture, slope, nearby villages and 7-day trend.",
      },
      { property: "og:title", content: "Risk Area Details — LandslideGuard" },
      {
        property: "og:description",
        content: "Deep-dive landslide risk analysis for a monitored area in NE India.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RiskDetails,
});

function Gauge({ score }: { score: number }) {
  const level = riskLevel(score);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative grid h-36 w-36 place-items-center">
      <svg className="h-36 w-36 -rotate-90" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={radius} fill="none" stroke="currentColor" strokeWidth="10" className="text-muted" />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke={riskHex[level]}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${circumference * score} ${circumference}`}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-3xl font-bold text-foreground">{score.toFixed(2)}</p>
        <p className="text-xs font-medium text-muted-foreground">{riskLabel[level]} risk</p>
      </div>
    </div>
  );
}

function RiskDetails() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const { data: locations = [] } = useQuery(locationsQuery);
  const { data: history = [] } = useQuery(historyQuery);
  const { data: reports = [] } = useQuery(reportsQuery);

  const location = locations.find((l) => l.id === id);

  if (!location) {
    return (
      <AppShell title="Risk area" user={profile ? { name: profile.name, role: profile.roleLabel } : null}>
        <SectionCard>
          <p className="text-sm text-muted-foreground">
            This area is not available.{" "}
            <Link to="/risk-map" className="font-semibold text-primary hover:underline">
              Back to risk map
            </Link>
          </p>
        </SectionCard>
      </AppShell>
    );
  }

  const trend = history
    .filter((h) => h.location_id === location.id)
    .map((h) => ({
      date: new Date(h.recorded_on).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      score: h.risk_score,
      rainfall: h.rainfall,
    }));

  const localReports = reports.filter((r) => r.location_name === location.name).slice(0, 4);

  async function createAlert() {
    if (!location) return;
    const level = riskLevel(location.risk_score);
    const { error } = await supabase.from("alerts").insert({
      location_id: location.id,
      location_name: location.name,
      title: `${riskLabel[level]} risk alert issued for ${location.name}`,
      message: `Manual alert raised by ${profile?.name ?? "an officer"}. Risk score ${location.risk_score.toFixed(2)}, rainfall ${location.rainfall_24h} mm in 24h.`,
      severity: level,
      risk_score: location.risk_score,
      predicted_in: "6 hours",
      status: "active",
    });
    if (error) {
      toast.error("Could not create the alert. Please try again.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["alerts"] });
    toast.success("Alert created and sent to the alerts board");
    navigate({ to: "/alerts" });
  }

  const factors = [
    { icon: CloudRain, label: "Rainfall (24h)", value: `${location.rainfall_24h} mm` },
    { icon: Droplets, label: "Soil Moisture", value: `${location.soil_moisture}%` },
    { icon: Triangle, label: "Slope Angle", value: `${location.slope_angle}°` },
    { icon: Mountain, label: "Elevation", value: `${location.elevation} m` },
  ];

  return (
    <AppShell
      title={location.name}
      subtitle={`${location.district}, ${location.state} · ${location.latitude.toFixed(3)}°N, ${location.longitude.toFixed(3)}°E`}
      user={profile ? { name: profile.name, role: profile.roleLabel } : null}
      actions={
        <>
          <Button asChild size="sm" variant="outline">
            <Link to="/risk-map">View on Map</Link>
          </Button>
          <Button size="sm" onClick={createAlert}>
            Create Alert
          </Button>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <SectionCard title="Risk Score">
          <div className="flex flex-col items-center gap-3">
            <Gauge score={location.risk_score} />
            <RiskBadge score={location.risk_score} showScore />
            <p className="text-center text-xs text-muted-foreground">
              Alert threshold 0.56 · Updated {formatDateTime(location.updated_at)}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => toast.success(`Response team assigned to ${location.name}`)}
            >
              Assign Response
            </Button>
          </div>
        </SectionCard>

        <SectionCard title="Key Factors">
          <div className="grid gap-3 sm:grid-cols-2">
            {factors.map((f) => (
              <div key={f.label} className="flex items-center gap-3 rounded-md border border-border p-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
                  <f.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs text-muted-foreground">{f.label}</p>
                  <p className="text-lg font-semibold text-foreground">{f.value}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Land cover</p>
              <p className="text-sm font-medium text-foreground">{location.land_cover}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" /> Population exposed
              </p>
              <p className="text-sm font-medium text-foreground">
                {location.population.toLocaleString("en-IN")}
              </p>
            </div>
          </div>
          <div className="mt-3 rounded-md border border-border p-3">
            <p className="text-xs text-muted-foreground">Nearby villages</p>
            <p className="text-sm text-foreground">{location.nearby_villages}</p>
          </div>
        </SectionCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <SectionCard title="Risk Trend (Last 7 Days)" description="Daily computed risk score">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 1]} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke={riskHex[riskLevel(location.risk_score)]}
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Location on Map">
          <MapPanel locations={[location]} height={224} compact />
        </SectionCard>
      </div>

      <SectionCard
        className="mt-4"
        title="Recent Field Reports"
        actions={
          <Button asChild size="sm" variant="ghost">
            <Link to="/field-reports">All reports →</Link>
          </Button>
        }
      >
        {localReports.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No field reports submitted for this area yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {localReports.map((r) => (
              <li key={r.id} className="rounded-md border border-border p-3">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                  <p className="min-w-0 text-sm font-semibold text-foreground">{r.report_type}</p>
                  <StatusPill status={r.status} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <TrendingUp className="h-3 w-3" /> {r.reporter_name} ·{" "}
                  {formatDateTime(r.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </AppShell>
  );
}
