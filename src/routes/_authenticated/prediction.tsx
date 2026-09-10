import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Info, Loader2, Play } from "lucide-react";
import {
  Bar,
  BarChart,
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
import { RiskBadge } from "@/components/risk-badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { historyQuery, locationsQuery } from "@/lib/api";
import { useProfile } from "@/hooks/use-profile";
import { riskHex, riskLabel, riskLevel } from "@/lib/risk";

export const Route = createFileRoute("/_authenticated/prediction")({
  head: () => ({
    meta: [
      { title: "AI Prediction — LandslideGuard" },
      {
        name: "description",
        content:
          "Run demo landslide risk predictions for NE India with LSTM + Random Forest or XGBoost across 24h, 48h and 7-day windows.",
      },
      { property: "og:title", content: "AI Prediction — LandslideGuard" },
      {
        property: "og:description",
        content: "Predictive landslide risk analysis for the North Eastern Region of India.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PredictionPage,
});

type Result = {
  id: string;
  name: string;
  score: number;
  probability: number;
  confidence: number;
};

const WINDOW_FACTOR: Record<string, number> = { "24h": 1.0, "48h": 1.06, "7d": 1.12 };
const MODEL_ACCURACY: Record<string, number> = {
  "LSTM + Random Forest": 91.4,
  XGBoost: 88.9,
};

function PredictionPage() {
  const { data: profile } = useProfile();
  const { data: locations = [] } = useQuery(locationsQuery);
  const { data: history = [] } = useQuery(historyQuery);

  const [region, setRegion] = useState("all");
  const [window, setWindow] = useState("7d");
  const [model, setModel] = useState("LSTM + Random Forest");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);

  const scoped = region === "all" ? locations : locations.filter((l) => l.district === region);
  const districts = Array.from(new Set(locations.map((l) => l.district))).sort();

  function runAnalysis() {
    setRunning(true);
    setResults(null);
    setTimeout(() => {
      const factor = WINDOW_FACTOR[window] ?? 1;
      const modelBias = model === "XGBoost" ? 0.97 : 1.0;
      const computed = scoped
        .map((l) => {
          const score = Math.min(
            0.98,
            Number(
              (
                (l.risk_score * 0.62 +
                  (l.rainfall_24h / 200) * 0.2 +
                  (l.soil_moisture / 100) * 0.1 +
                  (l.slope_angle / 60) * 0.08) *
                factor *
                modelBias
              ).toFixed(2),
            ),
          );
          return {
            id: l.id,
            name: l.name,
            score,
            probability: Number(Math.min(0.99, score * 1.05).toFixed(2)),
            confidence: Number((MODEL_ACCURACY[model]! - 6 + score * 8).toFixed(1)),
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);
      setResults(computed);
      setRunning(false);
    }, 1400);
  }

  const trend = Array.from({ length: 7 }, (_, d) => {
    const day = history.filter((h) => h.recorded_on === history[d]?.recorded_on);
    const avg =
      day.length > 0 ? day.reduce((s, h) => s + h.risk_score, 0) / day.length : 0.4 + d * 0.03;
    return {
      day: `Day ${d + 1}`,
      score: Number(avg.toFixed(2)),
    };
  });

  const contributing = [
    { factor: "Rainfall intensity", weight: 34 },
    { factor: "Soil moisture", weight: 26 },
    { factor: "Slope angle", weight: 18 },
    { factor: "Historical events", weight: 12 },
    { factor: "Land cover", weight: 10 },
  ];

  return (
    <AppShell
      title="AI Prediction & Analytics"
      subtitle="Model-driven landslide risk forecasting for the North Eastern Region"
      user={profile ? { name: profile.name, role: profile.roleLabel } : null}
    >
      <div className="mb-4 flex items-start gap-3 rounded-lg border border-risk-moderate/40 bg-risk-moderate-soft p-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-risk-moderate" />
        <p className="text-xs font-medium text-foreground">
          DEMO AI MODEL — AI predictions support decision-making and do not replace official
          authority assessment.
        </p>
      </div>

      <SectionCard title="Run Risk Prediction">
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Select Region</p>
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All monitored districts</SelectItem>
                {districts.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Prediction Window</p>
            <Select value={window} onValueChange={setWindow}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Next 24 hours</SelectItem>
                <SelectItem value="48h">Next 48 hours</SelectItem>
                <SelectItem value="7d">Next 7 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Model</p>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LSTM + Random Forest">LSTM + Random Forest</SelectItem>
                <SelectItem value="XGBoost">XGBoost</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button className="w-full lg:w-auto" onClick={runAnalysis} disabled={running}>
              {running ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Run Analysis
            </Button>
          </div>
        </div>
      </SectionCard>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_1.2fr]">
        <SectionCard title="Predicted Risk Map">
          <MapPanel locations={scoped} height={300} compact />
        </SectionCard>

        <SectionCard
          title="Prediction Results"
          description={`Model accuracy: ${MODEL_ACCURACY[model]}% · Window: ${window}`}
        >
          {running && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Running {model} over {scoped.length} monitored areas…
            </p>
          )}
          {!running && !results && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Select a region and press Run Analysis to generate predictions.
            </p>
          )}
          {!running && results && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Location</th>
                    <th className="pb-2 pr-3 font-medium">Predicted Risk</th>
                    <th className="pb-2 pr-3 font-medium">Probability</th>
                    <th className="pb-2 font-medium">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2.5 pr-3 font-medium text-foreground">{r.name}</td>
                      <td className="py-2.5 pr-3">
                        <RiskBadge score={r.score} />
                      </td>
                      <td className="py-2.5 pr-3 text-foreground">{r.probability.toFixed(2)}</td>
                      <td className="py-2.5 text-muted-foreground">{r.confidence.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <SectionCard title="Contributing Factors" description="Model feature importance">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={contributing} layout="vertical" margin={{ left: 30 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis dataKey="factor" type="category" width={110} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="weight" fill={riskHex.high} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Predicted Risk Trend" description="Regional average over the window">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="day" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 1]} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke={riskHex.critical} strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {results?.[0] && (
            <p className="mt-3 text-xs text-muted-foreground">
              Highest predicted risk: <span className="font-semibold text-foreground">{results[0].name}</span>{" "}
              at {results[0].score.toFixed(2)} ({riskLabel[riskLevel(results[0].score)]}).
            </p>
          )}
        </SectionCard>
      </div>
    </AppShell>
  );
}
