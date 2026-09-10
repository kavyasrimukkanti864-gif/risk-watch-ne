import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2, MapPin } from "lucide-react";

import { AppShell, SectionCard } from "@/components/app-shell";
import { RiskBadge, StatusPill } from "@/components/risk-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { locationsQuery, reportsQuery } from "@/lib/api";
import { useProfile } from "@/hooks/use-profile";
import { formatDateTime } from "@/lib/risk";
import { supabase } from "@/integrations/supabase/client";
import type { RiskLevel } from "@/lib/risk";

export const Route = createFileRoute("/_authenticated/field-reports")({
  head: () => ({
    meta: [
      { title: "Field Reports — LandslideGuard" },
      {
        name: "description",
        content:
          "Submit and review on-ground landslide field reports with location, severity, description and photo evidence.",
      },
      { property: "og:title", content: "Field Reports — LandslideGuard" },
      {
        property: "og:description",
        content: "Ground-truth reporting for landslide monitoring in NE India.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FieldReportsPage,
});

const TYPES = [
  "Landslide",
  "Ground Crack",
  "Rockfall",
  "Road Blockage",
  "Waterlogging",
  "Slope Instability",
  "Other",
];
const SEVERITIES: RiskLevel[] = ["low", "moderate", "high", "critical"];

function FieldReportsPage() {
  const { data: profile } = useProfile();
  const { data: locations = [] } = useQuery(locationsQuery);
  const { data: reports = [] } = useQuery(reportsQuery);
  const queryClient = useQueryClient();

  const [locationId, setLocationId] = useState("");
  const [reportType, setReportType] = useState("Landslide");
  const [severity, setSeverity] = useState<RiskLevel>("moderate");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [useGps, setUseGps] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const location = locations.find((l) => l.id === locationId);
    if (!location) {
      toast.error("Please select a location.");
      return;
    }
    setSubmitting(true);

    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    let photoUrl: string | null = null;

    if (photo && userId) {
      const path = `${userId}/${Date.now()}-${photo.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const { error: uploadError } = await supabase.storage
        .from("field-reports")
        .upload(path, photo);
      if (uploadError) {
        toast.error("Photo upload failed — the report will be saved without it.");
      } else {
        photoUrl = path;
      }
    }

    const { error } = await supabase.from("field_reports").insert({
      user_id: userId ?? null,
      location_id: location.id,
      location_name: location.name,
      report_type: reportType,
      severity,
      description,
      photo_url: photoUrl,
      gps_latitude: useGps ? location.latitude : null,
      gps_longitude: useGps ? location.longitude : null,
      reporter_name: profile?.name ?? "Field Officer",
      status: "pending",
    });

    setSubmitting(false);
    if (error) {
      toast.error("Could not submit the report. Please try again.");
      return;
    }
    toast.success("Field report submitted");
    setDescription("");
    setPhoto(null);
    await queryClient.invalidateQueries({ queryKey: ["field_reports"] });
  }

  return (
    <AppShell
      title="Field Reports"
      subtitle="Ground observations from officers across the monitored region"
      user={profile ? { name: profile.name, role: profile.roleLabel } : null}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_1fr]">
        <SectionCard title="Submit Field Report">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>Location</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Click to select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name} — {l.district}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Report Type</Label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Severity</Label>
                <Select value={severity} onValueChange={(v) => setSeverity(v as RiskLevel)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITIES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                required
                rows={4}
                maxLength={1000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter detailed description of what you observed..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="photo">Upload Photo</Label>
              <Input
                id="photo"
                type="file"
                accept="image/*"
                onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              />
              {photo && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Camera className="h-3.5 w-3.5" /> {photo.name}
                </p>
              )}
            </div>

            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={useGps}
                onChange={(e) => setUseGps(e.target.checked)}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> Use current GPS location
            </label>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Report
            </Button>
          </form>
        </SectionCard>

        <SectionCard title="Recent Field Reports" description={`${reports.length} submitted`}>
          <ul className="max-h-[620px] space-y-3 overflow-y-auto">
            {reports.map((r) => (
              <li key={r.id} className="rounded-md border border-border p-3">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {r.report_type} · {r.location_name}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {r.description}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <RiskBadge level={r.severity as RiskLevel} />
                    <StatusPill status={r.status} />
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {r.reporter_name} · {formatDateTime(r.created_at)}
                </p>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </AppShell>
  );
}
