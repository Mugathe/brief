/** Tiny dependency-free charts used on the Trending and Trails pages. */

export function Sparkline({ values, width = 120, height = 32, label }: { values: number[]; width?: number; height?: number; label: string }) {
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const y = (v: number) => height - 2 - (v / max) * (height - 4);
  const pts = values.map((v, n) => `${(n * step).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="shrink-0 overflow-visible">
      {values.length > 1 && <polygon points={`0,${height} ${pts} ${width},${height}`} fill="var(--primary)" opacity="0.12" />}
      <polyline points={values.length ? pts : `0,${height - 2} ${width},${height - 2}`} fill="none" stroke="var(--primary)" strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  );
}

export function VolumeChart({ data }: { data: { month: string; stories: number; sources: number }[] }) {
  if (!data.length) return null;
  const W = 640, H = 140, pad = 18;
  const max = Math.max(1, ...data.map((d) => d.stories));
  const bw = (W - 2) / data.length;
  return (
    <svg role="img" aria-label="Stories per month" viewBox={`0 0 ${W} ${H + pad}`} className="w-full">
      {data.map((d, n) => {
        const h = Math.max(d.stories ? 2 : 0, (d.stories / max) * (H - 8));
        const label = new Date(d.month + "T00:00:00Z").toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
        return (
          <g key={d.month}>
            <rect x={n * bw + 1} y={H - h} width={Math.max(1, bw - 2)} height={h} fill="var(--primary)" opacity={d.stories ? 0.85 : 0.2}>
              <title>{`${label}: ${d.stories} ${d.stories === 1 ? "story" : "stories"} from ${d.sources} ${d.sources === 1 ? "outlet" : "outlets"}`}</title>
            </rect>
            {d.month.slice(5, 7) === "01" || n === 0 ? <text x={n * bw + 1} y={H + 13} fontSize="10" fill="var(--muted-foreground)">{d.month.slice(0, 4)}</text> : null}
          </g>
        );
      })}
      <line x1="0" x2={W} y1={H} y2={H} stroke="var(--border)" />
    </svg>
  );
}
