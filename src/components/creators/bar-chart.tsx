/** A small accessible bar chart (server-rendered SVG): one bar per period, value labels on hover. */
export function BarChart({ data, label, format = (n: number) => String(n), height = 140 }: { data: { key: string; label: string; value: number }[]; label: string; format?: (n: number) => string; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 100 / Math.max(1, data.length);
  return (
    <figure className="space-y-2">
      <svg viewBox={`0 0 100 ${height / 3}`} preserveAspectRatio="none" className="h-36 w-full" role="img" aria-label={`${label}: ${data.map((d) => `${d.label} ${format(d.value)}`).join("، ")}`}>
        {data.map((d, i) => {
          const h = (d.value / max) * (height / 3 - 2);
          return (
            <rect key={d.key} x={i * w + w * 0.15} y={height / 3 - h} width={w * 0.7} height={Math.max(h, d.value > 0 ? 0.6 : 0.2)} rx="0.6" className={d.value > 0 ? "fill-pine" : "fill-line"}>
              <title>{`${d.label}: ${format(d.value)}`}</title>
            </rect>
          );
        })}
      </svg>
      <figcaption className="flex justify-between text-[11px] text-mute" dir="ltr"><span>{data[0]?.label}</span><span>{data[data.length - 1]?.label}</span></figcaption>
    </figure>
  );
}
