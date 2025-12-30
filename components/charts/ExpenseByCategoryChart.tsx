"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

export type CategorySpend = {
  name: string;
  value: number;
};

export function ExpenseByCategoryChart({ data }: { data: CategorySpend[] }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="categoryBar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.4} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="4 4"
            stroke="rgba(148,163,184,0.15)"
            vertical={false}
          />
          <XAxis
            dataKey="name"
            tick={{ fill: "currentColor", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            minTickGap={12}
          />
          <YAxis
            tick={{ fill: "currentColor", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <Tooltip
            cursor={{ fill: "rgba(148,163,184,0.1)" }}
            contentStyle={{
              background: "rgba(15,23,42,0.9)",
              border: "1px solid rgba(148,163,184,0.2)",
              borderRadius: "10px",
              color: "#e2e8f0"
            }}
          />
          <Bar dataKey="value" fill="url(#categoryBar)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
