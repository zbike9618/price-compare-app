import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { yen } from "../lib/format.js";
import { ACCENT } from "../lib/theme.js";

const LINE_COLORS = [ACCENT, "#0891b2", "#16a34a", "#9333ea", "#d97706", "#db2777"];

export default function PriceHistoryChart({ data, storeNames }) {
  if (data.length < 2) return null;

  return (
    <div style={{ marginTop: 10 }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: "#64748b", margin: "0 0 6px" }}>
        直近30日の値段の動き
      </p>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
          <CartesianGrid stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={48} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #e2e8f0" }} formatter={(value) => yen(value)} />
          {storeNames.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {storeNames.map((name, i) => {
            const color = LINE_COLORS[i % LINE_COLORS.length];
            return (
              <Line
                key={name}
                type="monotone"
                dataKey={name}
                stroke={color}
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 0, fill: color }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
