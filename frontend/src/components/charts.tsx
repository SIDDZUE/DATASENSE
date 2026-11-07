"use client";

import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from "recharts";

export const VIZ = ["#a9661a", "#1d6a66", "#3f5878", "#9c573a", "#5b7043", "#684a6b"];

const axis = { fontSize: 10, fill: "var(--muted)" } as const;
const gridStroke = "var(--line)";

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--line-strong)",
  borderRadius: 3,
  fontSize: 11,
  color: "var(--ink)",
} as const;

export function HistogramChart({
  data, xLabel = "value", height = 220,
}: {
  data: { bin_start: number; bin_end: number; count: number }[];
  xLabel?: string;
  height?: number;
}) {
  const series = data.map((d) => ({
    label: `${fmtAxis(d.bin_start)}–${fmtAxis(d.bin_end)}`,
    count: d.count,
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={series} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid stroke={gridStroke} strokeDasharray="2 3" vertical={false} />
        <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: gridStroke }}
               interval="preserveStartEnd" minTickGap={24} />
        <YAxis tick={axis} tickLine={false} axisLine={false} width={44} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="count" fill={VIZ[0]} radius={[1, 1, 0, 0]} name={`count (${xLabel})`} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LineSeriesChart({
  data, xKey, series, height = 240, yLabel,
}: {
  data: Record<string, any>[];
  xKey: string;
  series: { key: string; label: string; color?: string }[];
  height?: number;
  yLabel?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 10, bottom: 4, left: 0 }}>
        <CartesianGrid stroke={gridStroke} strokeDasharray="2 3" vertical={false} />
        <XAxis dataKey={xKey} tick={axis} tickLine={false} axisLine={{ stroke: gridStroke }}
               minTickGap={32} />
        <YAxis tick={axis} tickLine={false} axisLine={false} width={48}
               label={yLabel ? { value: yLabel, angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "var(--muted)" } } : undefined} />
        <Tooltip contentStyle={tooltipStyle} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 10 }} />}
        {series.map((s, i) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.label}
                stroke={s.color ?? VIZ[i % VIZ.length]} strokeWidth={1.6}
                dot={false} isAnimationActive={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ScatterPlot({
  data, xKey, yKey, colorKey, height = 280,
}: {
  data: Record<string, any>[];
  xKey: string;
  yKey: string;
  colorKey?: string;
  height?: number;
}) {
  const groups = colorKey
    ? Array.from(new Set(data.map((d) => String(d[colorKey])))).slice(0, 8)
    : [null];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
        <CartesianGrid stroke={gridStroke} strokeDasharray="2 3" />
        <XAxis type="number" dataKey={xKey} name={xKey} tick={axis}
               tickLine={false} axisLine={{ stroke: gridStroke }}
               domain={["auto", "auto"]} />
        <YAxis type="number" dataKey={yKey} name={yKey} tick={axis}
               tickLine={false} axisLine={false} width={48}
               domain={["auto", "auto"]} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: "3 3" }} />
        {groups.map((g, i) => (
          <Scatter
            key={g ?? "all"}
            name={g ?? `${xKey} vs ${yKey}`}
            data={g === null ? data : data.filter((d) => String(d[colorKey!]) === g)}
            fill={VIZ[i % VIZ.length]}
            fillOpacity={0.65}
            isAnimationActive={false}
          />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export function BarSeriesChart({
  data, xKey, yKey, color = VIZ[1], height = 240, layout = "horizontal",
}: {
  data: Record<string, any>[];
  xKey: string;
  yKey: string;
  color?: string;
  height?: number;
  layout?: "horizontal" | "vertical";
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={layout}
                margin={{ top: 8, right: 16, bottom: 4, left: layout === "vertical" ? 8 : 0 }}>
        <CartesianGrid stroke={gridStroke} strokeDasharray="2 3"
                       vertical={layout === "horizontal"} horizontal={layout === "vertical"} />
        {layout === "horizontal" ? (
          <>
            <XAxis dataKey={xKey} tick={axis} tickLine={false} axisLine={{ stroke: gridStroke }} minTickGap={16} />
            <YAxis tick={axis} tickLine={false} axisLine={false} width={44} />
          </>
        ) : (
          <>
            <XAxis type="number" tick={axis} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey={xKey} tick={axis} tickLine={false}
                   axisLine={{ stroke: gridStroke }} width={130} />
          </>
        )}
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey={yKey} fill={color} radius={[1, 1, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CorrelationHeatmap({
  matrix, height,
}: {
  matrix: Record<string, Record<string, number | null>>;
  height?: number;
}) {
  const cols = Object.keys(matrix);
  if (cols.length === 0) return null;
  const shown = cols.slice(0, 14);
  const cell = 30;
  const size = shown.length * cell + 120;
  return (
    <div className="overflow-auto">
      <svg width={size} height={size} role="img" aria-label="Correlation heatmap">
        {shown.map((row, i) => (
          <g key={row}>
            <text x={118} y={i * cell + 20} textAnchor="end" fontSize={9}
                  fill="var(--muted)">{trunc(row, 16)}</text>
            {shown.map((col, j) => {
              const v = matrix[row]?.[col];
              return (
                <g key={col}>
                  {i === 0 && (
                    <text x={j * cell + 130 + cell / 2} y={10} fontSize={9}
                          fill="var(--muted)" transform={`rotate(-45 ${j * cell + 130 + cell / 2} 10)`}>
                      {trunc(col, 12)}
                    </text>
                  )}
                  <rect
                    x={j * cell + 126} y={i * cell + 8}
                    width={cell - 2} height={cell - 2}
                    fill={corrColor(v)} stroke="var(--surface)" strokeWidth={1}
                  >
                    <title>{`${row} × ${col}: ${v ?? "—"}`}</title>
                  </rect>
                  <text x={j * cell + 126 + (cell - 2) / 2} y={i * cell + 8 + cell / 2 + 3}
                        textAnchor="middle" fontSize={7.5}
                        fill={Math.abs(v ?? 0) > 0.55 ? "#fff" : "var(--ink-2)"}>
                    {v == null ? "" : v.toFixed(1)}
                  </text>
                </g>
              );
            })}
          </g>
        ))}
      </svg>
    </div>
  );
}

function corrColor(v: number | null): string {
  if (v == null || Number.isNaN(v)) return "var(--surface-2)";
  const a = Math.min(1, Math.abs(v));
  return v >= 0
    ? `rgba(29, 106, 102, ${0.12 + a * 0.82})`
    : `rgba(156, 87, 58, ${0.12 + a * 0.82})`;
}

function trunc(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function fmtAxis(n: number) {
  if (Math.abs(n) >= 1000) return n.toExponential(0);
  return Number(n.toFixed(2)).toString();
}
