"use client";

import { useState, type MouseEvent } from "react";
import type { ResultType } from "eecircuit-engine";

// Ordre categoriel fixe (jamais cyclé au hasard) — voir la skill dataviz,
// palette validée (CVD deltaE >= 8 / normal-vision deltaE >= 15).
const SERIES_COLORS = ["#2a78d6", "#008300", "#eda100", "#1baf7a"];

const WIDTH = 600;
const HEIGHT = 220;
const PADDING = { top: 16, right: 16, bottom: 12, left: 52 };
const PLOT_WIDTH = WIDTH - PADDING.left - PADDING.right;
const PLOT_HEIGHT = HEIGHT - PADDING.top - PADDING.bottom;
const GRID_LINES = 4;

export default function SpiceResultChart({ result }: { result: ResultType }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (result.dataType !== "real") {
    return (
      <p style={{ fontSize: 13, color: "#666" }}>
        Résultats en nombres complexes (analyse AC/fréquentielle) — pas encore de graphique pour ce cas.
      </p>
    );
  }

  const timeSeries = result.data.find((d) => d.type === "time");
  const voltageSeries = result.data.filter((d) => d.type === "voltage");

  if (!timeSeries || voltageSeries.length === 0 || timeSeries.values.length < 2) {
    return null;
  }

  const time = timeSeries.values;
  const tMin = time[0];
  const tMax = time[time.length - 1];
  const allValues = voltageSeries.flatMap((s) => s.values);
  const vMin = Math.min(0, ...allValues);
  const vMax = Math.max(...allValues);
  const vRange = vMax - vMin || 1;

  const x = (t: number) => PADDING.left + ((t - tMin) / (tMax - tMin || 1)) * PLOT_WIDTH;
  const y = (v: number) => PADDING.top + PLOT_HEIGHT - ((v - vMin) / vRange) * PLOT_HEIGHT;

  const pathFor = (values: number[]) =>
    values.map((v, i) => `${i === 0 ? "M" : "L"} ${x(time[i]).toFixed(2)} ${y(v).toFixed(2)}`).join(" ");

  function handleMouseMove(e: MouseEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * PLOT_WIDTH;
    const t = tMin + (relX / PLOT_WIDTH) * (tMax - tMin);
    let nearest = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < time.length; i++) {
      const diff = Math.abs(time[i] - t);
      if (diff < bestDiff) {
        bestDiff = diff;
        nearest = i;
      }
    }
    setHoverIndex(nearest);
  }

  const readoutIndex = hoverIndex ?? time.length - 1;

  return (
    <div style={{ marginTop: 12 }}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{
          width: "100%",
          height: "auto",
          background: "#fcfcfb",
          border: "1px solid #e1e0d9",
          borderRadius: 6,
        }}
      >
        {Array.from({ length: GRID_LINES + 1 }).map((_, i) => {
          const v = vMin + (vRange * i) / GRID_LINES;
          const gy = y(v);
          return (
            <g key={i}>
              <line
                x1={PADDING.left}
                x2={WIDTH - PADDING.right}
                y1={gy}
                y2={gy}
                stroke="#e1e0d9"
                strokeWidth={1}
              />
              <text x={PADDING.left - 6} y={gy + 3} textAnchor="end" fontSize={10} fill="#898781">
                {v.toFixed(1)}
              </text>
            </g>
          );
        })}

        {voltageSeries.map((s, i) => (
          <path
            key={s.name}
            d={pathFor(s.values)}
            fill="none"
            stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
            strokeWidth={2}
            strokeLinecap="round"
          />
        ))}

        {hoverIndex !== null && (
          <line
            x1={x(time[hoverIndex])}
            x2={x(time[hoverIndex])}
            y1={PADDING.top}
            y2={HEIGHT - PADDING.bottom}
            stroke="#c3c2b7"
            strokeWidth={1}
          />
        )}

        <rect
          x={PADDING.left}
          y={PADDING.top}
          width={PLOT_WIDTH}
          height={PLOT_HEIGHT}
          fill="transparent"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
        />
      </svg>

      {voltageSeries.length > 1 && (
        <div style={{ display: "flex", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
          {voltageSeries.map((s, i) => (
            <span
              key={s.name}
              style={{ fontSize: 12, color: "#52514e", display: "flex", alignItems: "center", gap: 4 }}
            >
              <span
                style={{
                  width: 10,
                  height: 2,
                  background: SERIES_COLORS[i % SERIES_COLORS.length],
                  display: "inline-block",
                }}
              />
              {s.name}
            </span>
          ))}
        </div>
      )}

      <p style={{ fontSize: 12, color: "#52514e", marginTop: 4 }}>
        {hoverIndex !== null ? `t = ${time[readoutIndex].toExponential(2)}s — ` : "Valeur finale — "}
        {voltageSeries.map((s) => `${s.name} = ${s.values[readoutIndex].toFixed(3)}V`).join(", ")}
      </p>
    </div>
  );
}
