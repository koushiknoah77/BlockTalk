'use client';
import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['#6EE7B7', '#93C5FD', '#F9A8D4', '#FCD34D', '#C4B5FD', '#FDBA74'];

type Asset = { symbol?: string; usd?: number; name?: string };

export default function AssetsBreakdown({
  size = 180,
  assets = [],
}: {
  size?: number;
  assets?: Asset[];
}) {
  // defensive: ensure assets is an array
  if (!Array.isArray(assets)) {
    console.warn('AssetsBreakdown: assets not an array', assets);
    assets = [];
  }

  // compute numeric values safely
  const normalized = useMemo(
    () =>
      assets.map((a) => {
        const value = Number(a?.usd ?? 0) || 0;
        const name = a?.symbol ?? a?.name ?? 'UNKNOWN';
        return { name, value };
      }),
    [assets]
  );

  const total = normalized.reduce((sum, a) => sum + a.value, 0);

  const data =
    normalized.length > 0 && total > 0
      ? normalized.map((a) => ({
          name: a.name,
          value: a.value,
          percent: total ? (a.value / total) * 100 : 0,
        }))
      : [{ name: 'No Assets', value: 1, percent: 100 }];

  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Assets breakdown</div>

      <div style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              cx="50%"
              cy="50%"
              outerRadius={Math.max(28, size / 2.3)}
              innerRadius={Math.max(12, size / 3.5)}
              paddingAngle={2}
              label={false}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => {
                const v = Number(value) || 0;
                return [`$${v.toFixed(2)}`, name];
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul style={{ fontSize: 13, marginTop: 6, color: 'var(--muted)', padding: 0, listStyle: 'none' }}>
        {data.map((a, i) => {
          const pct = Number(a.percent) || 0;
          const val = Number(a.value) || 0;
          return (
            <li key={i} style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: COLORS[i % COLORS.length], fontSize: 14 }}>●</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{a.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {pct.toFixed(1)}% • ${val.toFixed(2)}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
