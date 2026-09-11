'use client';

import { useMemo, useState } from 'react';
import { INK, SURFACE } from './theme';

// Stat-tile sparkline: a thin 2px line + faint area wash, current value called
// out with an end-dot. No axes — a sparkline's job is shape, not precision.
export function Sparkline({ data, color, height = 40 }) {
  const width = 120;
  const path = useMemo(() => {
    if (!data || data.length < 2) return null;
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const stepX = width / (data.length - 1);
    const points = data.map((v, i) => [i * stepX, height - ((v - min) / range) * (height - 6) - 3]);
    const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const area = `${line} L${width},${height} L0,${height} Z`;
    return { line, area, last: points[points.length - 1] };
  }, [data, height]);

  if (!path) return <div style={{ height }} />;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" aria-hidden="true">
      <path d={path.area} fill={color} opacity="0.12" />
      <path d={path.line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={path.last[0]} cy={path.last[1]} r="3" fill={color} stroke={SURFACE.cardAlt} strokeWidth="2" />
    </svg>
  );
}

// Two-series line/area trend chart with a hover crosshair + tooltip (the
// dataviz default — an HTML/SVG chart ships interactive, not as an upgrade).
export function TrendChart({ data, series }) {
  const [hoverIndex, setHoverIndex] = useState(null);
  const width = 1000;
  const height = 260;
  const padLeft = 40;
  const padBottom = 28;
  const padTop = 16;
  const plotWidth = width - padLeft - 16;
  const plotHeight = height - padBottom - padTop;

  const maxValue = useMemo(() => {
    const all = data.flatMap((d) => series.map((s) => d[s.key] || 0));
    const max = Math.max(...all, 1);
    // round up to a clean-ish step so gridline labels aren't jagged
    const step = Math.pow(10, Math.max(0, String(Math.ceil(max)).length - 1));
    return Math.max(Math.ceil(max / step) * step, 4);
  }, [data, series]);

  const stepX = data.length > 1 ? plotWidth / (data.length - 1) : 0;
  const yFor = (v) => padTop + plotHeight - (v / maxValue) * plotHeight;
  const xFor = (i) => padLeft + i * stepX;

  const seriesPaths = series.map((s) => {
    const points = data.map((d, i) => [xFor(i), yFor(d[s.key] || 0)]);
    const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    return { ...s, points, line };
  });

  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    const idx = Math.round((relX - padLeft) / (stepX || 1));
    setHoverIndex(Math.min(Math.max(idx, 0), data.length - 1));
  };

  const hovered = hoverIndex !== null ? data[hoverIndex] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
        className="overflow-visible"
      >
        {gridLines.map((f) => {
          const y = padTop + plotHeight * (1 - f);
          return (
            <g key={f}>
              <line x1={padLeft} x2={width} y1={y} y2={y} stroke={SURFACE.grid} strokeWidth="1" />
              <text x={padLeft - 8} y={y} textAnchor="end" dominantBaseline="middle" fontSize="11" fill={INK.muted}>
                {Math.round(maxValue * f)}
              </text>
            </g>
          );
        })}

        {seriesPaths.map((s) =>
          s.area ? (
            <path
              key={`${s.key}-area`}
              d={`${s.line} L${xFor(data.length - 1)},${padTop + plotHeight} L${padLeft},${padTop + plotHeight} Z`}
              fill={s.color}
              opacity="0.1"
            />
          ) : null
        )}
        {seriesPaths.map((s) => (
          <path key={s.key} d={s.line} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        ))}

        {data.map((d, i) => (
          <text
            key={d.label}
            x={xFor(i)}
            y={height - 6}
            textAnchor="middle"
            fontSize="11"
            fill={INK.muted}
          >
            {d.label}
          </text>
        ))}

        {hoverIndex !== null && (
          <>
            <line
              x1={xFor(hoverIndex)}
              x2={xFor(hoverIndex)}
              y1={padTop}
              y2={padTop + plotHeight}
              stroke={INK.muted}
              strokeWidth="1"
              strokeDasharray="3,3"
            />
            {seriesPaths.map((s) => (
              <circle
                key={s.key}
                cx={xFor(hoverIndex)}
                cy={yFor(data[hoverIndex][s.key] || 0)}
                r="4"
                fill={s.color}
                stroke={SURFACE.cardAlt}
                strokeWidth="2"
              />
            ))}
          </>
        )}
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute top-2 z-10 rounded-lg border px-3 py-2 text-xs shadow-lg"
          style={{
            left: `${Math.min(Math.max((xFor(hoverIndex) / width) * 100, 12), 88)}%`,
            transform: 'translateX(-50%)',
            background: SURFACE.cardAlt,
            borderColor: SURFACE.border,
          }}
        >
          <div className="mb-1 font-medium" style={{ color: INK.secondary }}>
            {hovered.label}
          </div>
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-2">
              <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: s.color }} />
              <span className="font-semibold" style={{ color: INK.primary }}>
                {hovered[s.key] || 0}
              </span>
              <span style={{ color: INK.muted }}>{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* A single series needs no legend box — the chart's own title already names it. */}
      <div className="mt-2 flex flex-wrap gap-4">
        {series.length > 1 &&
          series.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5 text-xs" style={{ color: INK.secondary }}>
              <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: s.color }} />
              {s.label}
            </div>
          ))}
      </div>
    </div>
  );
}

// Ranked horizontal bar list — one metric (count) across categories, so a
// single hue carries magnitude via bar length; labels already carry identity.
export function BarList({ items, color }) {
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <span className="truncate" style={{ color: INK.secondary }} title={item.label}>
              {item.label}
            </span>
            <span className="shrink-0 font-semibold" style={{ color: INK.primary }}>
              {item.value}
            </span>
          </div>
          <div className="h-1.5 rounded-full" style={{ background: SURFACE.grid }}>
            <div
              className="h-1.5 rounded-full"
              style={{ width: `${(item.value / max) * 100}%`, background: color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
