"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

export type CashflowPoint = {
  date: string;
  income: number;
  expense: number;
};

export function CashflowChart({ data }: { data: CashflowPoint[] }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="incomeLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#16a34a" stopOpacity={0.6} />
            </linearGradient>
            <linearGradient id="expenseLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#f97316" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#ea580c" stopOpacity={0.6} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="4 4"
            stroke="rgba(148,163,184,0.15)"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fill: "currentColor", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            minTickGap={18}
          />
          <YAxis
            tick={{ fill: "currentColor", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <Tooltip
            cursor={{ stroke: "rgba(148,163,184,0.3)", strokeWidth: 1 }}
            contentStyle={{
              background: "rgba(15,23,42,0.9)",
              border: "1px solid rgba(148,163,184,0.2)",
              borderRadius: "10px",
              color: "#e2e8f0"
            }}
          />
          <Line
            type="monotone"
            dataKey="income"
            stroke="url(#incomeLine)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="expense"
            stroke="url(#expenseLine)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
