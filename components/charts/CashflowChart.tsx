"use client";

import {
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
          <XAxis dataKey="date" tick={{ fill: "currentColor", fontSize: 12 }} />
          <YAxis tick={{ fill: "currentColor", fontSize: 12 }} />
          <Tooltip
            cursor={{ stroke: "rgba(148,163,184,0.3)", strokeWidth: 1 }}
            contentStyle={{
              background: "rgba(15,23,42,0.9)",
              border: "1px solid rgba(148,163,184,0.2)",
              borderRadius: "10px",
              color: "#e2e8f0"
            }}
          />
          <Line type="monotone" dataKey="income" stroke="#22c55e" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="expense" stroke="#f97316" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
