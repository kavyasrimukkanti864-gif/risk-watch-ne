import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CloudRain,
  Database,
  Droplets,
  History,
  Mountain,
  Satellite,
  Thermometer,
} from "lucide-react";

import { AppShell, SectionCard } from "@/components/app-shell";
import { StatusPill } from "@/components/risk-badge";
import { dataSourcesQuery } from "@/lib/api";
import { useProfile } from "@/hooks/use-profile";
import { timeAgo } from "@/lib/risk";

export const Route = createFileRoute("/_authenticated/data-sources")({
  head: () => ({
    meta: [
      { title: "Data Sources — LandslideGuard" },
      {
        name: "description",
        content:
          "Connection status for weather, rainfall radar, soil moisture sensors, satellite feeds, terrain DEM and historical landslide data.",
      },
      { property: "og:title", content: "Data Sources — LandslideGuard" },
      {
        property: "og:description",
        content: "Monitoring feeds powering landslide risk analysis in NE India.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DataSourcesPage,
});

const ICONS: Record<string, typeof Database> = {
  weather: Thermometer,
  rainfall: CloudRain,
  soil: Droplets,
  satellite: Satellite,
  terrain: Mountain,
  historical: History,
};

function DataSourcesPage() {
  const { data: profile } = useProfile();
  const { data: sources = [] } = useQuery(dataSourcesQuery);

  const connected = sources.filter((s) => s.status === "connected").length;

  return (
    <AppShell
      title="Data Sources"
      subtitle={`${connected} of ${sources.length} monitoring feeds connected`}
      user={profile ? { name: profile.name, role: profile.roleLabel } : null}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sources.map((source) => {
          const Icon = ICONS[source.category] ?? Database;
          return (
            <SectionCard key={source.id}>
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{source.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{source.provider}</p>
                </div>
                <StatusPill status={source.status} />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{source.description}</p>
              <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-xs">
                <div>
                  <dt className="text-muted-foreground">Latency</dt>
                  <dd className="font-semibold text-foreground">{source.latency_ms} ms</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Refresh</dt>
                  <dd className="font-semibold text-foreground">{source.refresh_interval}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Last sync</dt>
                  <dd className="font-semibold text-foreground">{timeAgo(source.last_sync)}</dd>
                </div>
              </dl>
            </SectionCard>
          );
        })}
      </div>
    </AppShell>
  );
}
