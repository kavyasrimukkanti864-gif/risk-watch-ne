import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { BellRing } from "lucide-react";

import { AppShell, SectionCard } from "@/components/app-shell";
import { RiskBadge, StatusPill } from "@/components/risk-badge";
import { Button } from "@/components/ui/button";
import { alertsQuery } from "@/lib/api";
import { useProfile } from "@/hooks/use-profile";
import { formatDateTime, riskLevel, timeAgo } from "@/lib/risk";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/alerts")({
  head: () => ({
    meta: [
      { title: "Alerts & Notifications — LandslideGuard" },
      {
        name: "description",
        content:
          "Critical, high and moderate landslide alerts for the North Eastern Region with acknowledge and resolve actions.",
      },
      { property: "og:title", content: "Alerts & Notifications — LandslideGuard" },
      {
        property: "og:description",
        content: "Track and act on landslide alerts across NE India.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AlertsPage,
});

const FILTERS = ["all", "critical", "high", "moderate", "resolved"] as const;

function AlertsPage() {
  const { data: profile } = useProfile();
  const { data: alerts = [] } = useQuery(alertsQuery);
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");

  const filtered = alerts.filter((a) => {
    if (filter === "all") return true;
    if (filter === "resolved") return a.status === "resolved";
    return a.severity === filter && a.status !== "resolved";
  });

  async function updateStatus(id: string, status: "acknowledged" | "resolved") {
    const { error } = await supabase
      .from("alerts")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error("Could not update this alert.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["alerts"] });
    toast.success(status === "resolved" ? "Alert resolved" : "Alert acknowledged");
  }

  return (
    <AppShell
      title="Alerts & Notifications"
      subtitle="Early warning alerts generated from live monitoring and AI predictions"
      user={profile ? { name: profile.name, role: profile.roleLabel } : null}
      actions={
        <Button
          size="sm"
          variant="outline"
          onClick={() => toast.success("All alerts marked as read")}
        >
          Mark all as read
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-semibold capitalize transition-colors",
              filter === f
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <SectionCard>
            <p className="py-6 text-center text-sm text-muted-foreground">
              No alerts in this category.
            </p>
          </SectionCard>
        )}
        {filtered.map((alert) => (
          <article key={alert.id} className="rounded-lg border border-border bg-card p-4">
            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-risk-critical-soft text-risk-critical">
                <BellRing className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold text-foreground">{alert.title}</h2>
                  <RiskBadge level={riskLevel(alert.risk_score)} />
                  <StatusPill status={alert.status} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{alert.message}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {alert.location_name} · Risk score {alert.risk_score.toFixed(2)} · Predicted in{" "}
                  {alert.predicted_in} · {timeAgo(alert.created_at)} ({formatDateTime(alert.created_at)})
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {alert.location_id && (
                    <Button asChild size="sm" variant="outline">
                      <Link to="/risk/$id" params={{ id: alert.location_id }}>
                        View Details
                      </Link>
                    </Button>
                  )}
                  {alert.status === "active" && (
                    <Button size="sm" variant="secondary" onClick={() => updateStatus(alert.id, "acknowledged")}>
                      Acknowledge
                    </Button>
                  )}
                  {alert.status !== "resolved" && (
                    <Button size="sm" onClick={() => updateStatus(alert.id, "resolved")}>
                      Resolve
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
