"use client";

import { useState } from "react";

// Ordre categoriel fixe (jamais cyclé au hasard) — meme palette validée que
// SpiceResultChart.tsx (skill dataviz, CVD deltaE >= 8 / normal-vision deltaE >= 15).
const SERIES_COLORS = ["#2a78d6", "#008300", "#eda100"];
const SERIES_LABELS = ["Leçons terminées", "Devoirs rendus", "Présences"];
const SERIES_KEYS = ["lecons", "devoirs", "presences"] as const;

const WIDTH = 640;
const HEIGHT = 260;
const PADDING = { top: 16, right: 16, bottom: 28, left: 32 };
const PLOT_WIDTH = WIDTH - PADDING.left - PADDING.right;
const PLOT_HEIGHT = HEIGHT - PADDING.top - PADDING.bottom;
const GRID_LINES = 4;

export type ActivityBucket = { label: string; lecons: number; devoirs: number; presences: number };

export default function ActivityChart({
  daily,
  weekly,
}: {
  daily: ActivityBucket[];
  weekly: ActivityBucket[];
}) {
  const [mode, setMode] = useState<"jour" | "semaine">("jour");
  const [hover, setHover] = useState<{ bucketIndex: number; seriesIndex: number } | null>(null);
  const buckets = mode === "jour" ? daily : weekly;

  const rawMax = Math.max(1, ...buckets.flatMap((b) => [b.lecons, b.devoirs, b.presences]));
  const gridStep = Math.max(1, Math.ceil(rawMax / GRID_LINES));
  const maxValue = gridStep * GRID_LINES;
  const groupWidth = PLOT_WIDTH / buckets.length;
  const groupPadding = 8;
  const barGap = 2;
  const barWidth = Math.max((groupWidth - groupPadding - barGap * 2) / 3, 1);

  const y = (v: number) => PADDING.top + PLOT_HEIGHT - (v / maxValue) * PLOT_HEIGHT;
  const barHeight = (v: number) => (v / maxValue) * PLOT_HEIGHT;

  return (
    <div>
      <div className="mb-2 flex gap-2">
        <button
          type="button"
          onClick={() => setMode("jour")}
          className={mode === "jour" ? "btn-secondary btn-sm" : "btn-link text-sm"}
        >
          Jour
        </button>
        <button
          type="button"
          onClick={() => setMode("semaine")}
          className={mode === "semaine" ? "btn-secondary btn-sm" : "btn-link text-sm"}
        >
          Semaine
        </button>
      </div>

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
          const v = (maxValue * i) / GRID_LINES;
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
                {Math.round(v)}
              </text>
            </g>
          );
        })}

        {buckets.map((b, bi) => {
          const groupX = PADDING.left + bi * groupWidth + groupPadding / 2;
          return (
            <g key={bi}>
              {SERIES_KEYS.map((key, si) => {
                const v = b[key];
                const bx = groupX + si * (barWidth + barGap);
                const bh = barHeight(v);
                const by = PADDING.top + PLOT_HEIGHT - bh;
                const isHover = hover?.bucketIndex === bi && hover?.seriesIndex === si;
                return (
                  <rect
                    key={key}
                    x={bx}
                    y={by}
                    width={barWidth}
                    height={bh}
                    rx={2}
                    fill={SERIES_COLORS[si]}
                    opacity={isHover ? 0.75 : 1}
                    onMouseEnter={() => setHover({ bucketIndex: bi, seriesIndex: si })}
                    onMouseLeave={() => setHover(null)}
                  />
                );
              })}
              <text
                x={groupX + (groupWidth - groupPadding) / 2}
                y={HEIGHT - PADDING.bottom + 14}
                textAnchor="middle"
                fontSize={9}
                fill="#898781"
              >
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex flex-wrap gap-3">
        {SERIES_LABELS.map((label, i) => (
          <span key={label} className="flex items-center gap-1 text-xs text-gray-600">
            <span
              style={{
                width: 10,
                height: 10,
                background: SERIES_COLORS[i],
                display: "inline-block",
                borderRadius: 2,
              }}
            />
            {label}
          </span>
        ))}
      </div>

      <p className="mt-1 text-xs text-gray-500">
        {hover
          ? `${buckets[hover.bucketIndex].label} — ${SERIES_LABELS[hover.seriesIndex]} : ${
              buckets[hover.bucketIndex][SERIES_KEYS[hover.seriesIndex]]
            }`
          : "Survolez une barre pour le détail."}
      </p>

      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900">
          Voir les données en tableau
        </summary>
        <table className="mt-2 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-1 pr-2 font-medium">{mode === "jour" ? "Jour" : "Semaine du"}</th>
              {SERIES_LABELS.map((label) => (
                <th key={label} className="py-1 pr-2 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr key={b.label} className="border-b border-gray-100 text-gray-700">
                <td className="py-1 pr-2">{b.label}</td>
                {SERIES_KEYS.map((key) => (
                  <td key={key} className="py-1 pr-2">
                    {b[key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
