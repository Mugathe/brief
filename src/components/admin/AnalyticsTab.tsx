import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, TriangleAlert } from "lucide-react";
import { getAnalytics } from "@/lib/admin.functions";
import { listAds } from "@/lib/manage.functions";
import { placementLabel } from "@/lib/ads";
import { isIgnoredDevice, setIgnoredDevice } from "@/lib/tracker";
import type { Ranked } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Section, errMsg } from "./shared";

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card className="rounded-none">
      <CardContent className="p-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-1 text-3xl font-black" style={{ fontFamily: "'Fraunces', serif" }}>{typeof value === "number" ? value.toLocaleString() : value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

/** Each row: the number of different devices, with the extra loads or visits in grey beside it. */
function BarList({ rows, empty = "No data yet", unit = "views" }: { rows: Ranked[]; empty?: string; unit?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.visitors));
  if (!rows.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="text-sm">
          <div className="flex justify-between gap-3">
            <span className="truncate" title={r.label}>{r.label}</span>
            <span className="shrink-0 tabular-nums"><strong>{r.visitors.toLocaleString()}</strong> <span className="text-xs text-muted-foreground">{r.visitors === 1 ? "device" : "devices"}{r.views !== r.visitors ? ` · ${r.views.toLocaleString()} ${unit}` : ""}</span></span>
          </div>
          <div className="mt-0.5 h-1.5 bg-muted"><div className="h-1.5 bg-primary" style={{ width: `${(r.visitors / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

const tick = { fontSize: 11, fill: "var(--muted-foreground)" };

export function AnalyticsTab() {
  const [days, setDays] = useState(14);
  const [ignored, setIgnored] = useState(isIgnoredDevice());
  const q = useQuery({ queryKey: ["analytics", days], queryFn: () => getAnalytics({ data: { days } }), refetchInterval: 60_000 });
  const adsQ = useQuery({ queryKey: ["ads"], queryFn: () => listAds() });

  if (q.isLoading) return <p className="py-16 text-center text-muted-foreground">Loading analytics…</p>;
  if (q.error || !q.data) return <p className="py-16 text-center text-destructive">{errMsg(q.error)}</p>;
  const d = q.data;
  const t = d.totals;

  const exportCsv = () => {
    const pairs = (name: string, rows: Ranked[]) => [[], [name, "Devices", "Views"], ...rows.map((r) => [r.label, r.visitors, r.views])];
    const rows: (string | number)[][] = [["Metric", "Value"], ...Object.entries(t), ...pairs("Section", d.sections), ...pairs("Page", d.topPages), ...pairs("Source", d.referrers), [], ["Day", "Views", "Devices"], ...d.daily.map((r) => [r.day, r.views, r.visitors])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `kenya-pulse-analytics-${days}d.csv`;
    a.click();
  };

  const adRows = (adsQ.data ?? []).map((ad) => {
    const s = d.ads[ad.id] ?? { views: 0, clicks: 0, reach: 0, clickers: 0 };
    return { ...ad, ...s, rate: s.reach ? (s.clickers / s.reach) * 100 : 0 };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-44 rounded-none"><SelectValue /></SelectTrigger>
          <SelectContent>{[1, 7, 14, 30, 90].map((n) => <SelectItem key={n} value={String(n)}>{n === 1 ? "Last 24 hours" : `Last ${n} days`}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="outline" className="rounded-none" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
      </div>

      <div className="border-l-4 border-secondary pl-3 text-sm text-muted-foreground">
        <p><strong className="text-foreground">How counting works.</strong> A device (one browser) is <em>one visitor</em>, however many pages it opens. On each page, every device is counted once, and its extra page loads are shown in grey as “views”. A device that comes back later makes a new <em>visit</em>.</p>
        <label className="mt-2 flex items-center gap-2 text-foreground">
          <Switch checked={!ignored} onCheckedChange={(on) => { setIgnoredDevice(!on); setIgnored(!on); }} />
          <span className="text-sm">{ignored ? "This device is not counted (you are signed in as staff). Switch on to test tracking." : "This device is being counted, so your own browsing shows up here."}</span>
        </label>
      </div>

      {d.spike && (
        <div role="alert" className="flex items-center gap-3 border-2 border-primary bg-primary/10 p-3 text-sm font-semibold">
          <TriangleAlert className="h-5 w-5 text-primary" />
          Traffic spike: {t.lastHourVisitors.toLocaleString()} devices made {t.lastHourViews.toLocaleString()} page loads in the last hour, far above the usual {t.avgViewsPerHour.toLocaleString()} loads an hour. Check the Security tab and your sources.
        </div>
      )}
      {d.truncated && <p className="text-xs text-muted-foreground">Very high volume: figures use the most recent 50,000 records.</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Live now" value={t.liveNow} sub="devices in the last 5 minutes" />
        <Stat label="Unique visitors" value={t.visitors} sub={`${t.newVisitors} came once · ${t.returningVisitors} came back`} />
        <Stat label="Visits" value={t.visits} sub={`${t.viewsPerVisit} pages per visit`} />
        <Stat label="Page views" value={t.views} sub={`all page loads · ${t.lastHourVisitors} devices in the last hour`} />
        <Stat label="WhatsApp / card shares" value={t.shares} />
        <Stat label="Story clicks" value={t.storyClicks} />
        <Stat label="Audio plays" value={t.audioPlays} />
      </div>

      <Section title="Devices and page views per day" hint="Devices: different browsers that day. Views: every page load.">
        <div className="h-64">
          <ResponsiveContainer>
            <AreaChart data={d.daily} margin={{ left: -16, right: 8, top: 8 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={tick} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis tick={tick} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", fontSize: 12 }} />
              <Area type="monotone" dataKey="views" name="Views" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.12} />
              <Area type="monotone" dataKey="visitors" name="Devices" stroke="var(--secondary)" fill="var(--secondary)" fillOpacity={0.25} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="What people visit" hint="Devices per section. Each device is counted once per section."><BarList rows={d.sections} /></Section>
        <Section title="Top pages" hint="Devices per page. Each device is counted once per page."><BarList rows={d.topPages} /></Section>
        <Section title="Manifesto profiles" hint="Devices that opened each profile"><BarList rows={d.manifestoProfiles} empty="No profile views yet" /></Section>
        <Section title="Most-clicked stories" hint="Devices that clicked, with total clicks beside it"><BarList rows={d.topStories.map((r) => ({ ...r, label: r.label.replace(/^https?:\/\//, "") }))} unit="clicks" empty="No story clicks yet" /></Section>
        <Section title="Where visits come from" hint="Counted once per visit, not once per page"><BarList rows={d.referrers} unit="visits" /></Section>
        <Section title="Countries" hint="Needs Cloudflare country headers; blank otherwise"><BarList rows={d.countries} /></Section>
        <Section title="Device types"><BarList rows={d.devices} /></Section>
        <Section title="Actions" hint="Devices that did each thing, with the total beside it"><BarList rows={d.events} unit="times" empty="No actions recorded yet" /></Section>
      </div>

      <Section title="Busiest hours" hint="Visits starting in each hour of the day, East Africa Time. Useful for timing sponsor campaigns.">
        <div className="h-48">
          <ResponsiveContainer>
            <BarChart data={d.hourly} margin={{ left: -16, right: 8, top: 8 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="hour" tick={tick} />
              <YAxis tick={tick} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", fontSize: 12 }} />
              <Bar dataKey="visits" name="Visits" fill="var(--primary)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <Section title="Ad performance" hint="Reach is the number of different devices that saw the ad. Click rate is the share of those devices that clicked. Google AdSense earnings are in your AdSense account.">
        {adRows.length === 0 ? <p className="text-sm text-muted-foreground">No ads created yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground"><th className="py-2">Ad</th><th>Placement</th><th className="text-right">Reach (devices)</th><th className="text-right">Times shown</th><th className="text-right">Clicks</th><th className="text-right">Click rate</th></tr></thead>
              <tbody>
                {adRows.map((a) => (
                  <tr key={a.id} className="border-b border-border/60">
                    <td className="py-2 font-medium">{a.title}{a.sponsor ? <span className="text-muted-foreground"> · {a.sponsor}</span> : null}</td>
                    <td className="text-muted-foreground">{placementLabel(a.placement)}</td>
                    <td className="text-right tabular-nums">{a.reach.toLocaleString()}</td>
                    <td className="text-right tabular-nums">{a.views.toLocaleString()}</td>
                    <td className="text-right tabular-nums">{a.clicks.toLocaleString()}</td>
                    <td className="text-right tabular-nums">{a.rate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
