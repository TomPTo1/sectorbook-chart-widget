import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  BarChart,
  AreaChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

// 간단한 mock 데이터 생성
function generateData(count: number) {
  const data = [];
  const baseDate = new Date(2024, 0, 1);
  for (let i = 0; i < count; i++) {
    const date = new Date(baseDate);
    date.setMonth(date.getMonth() + i);
    data.push({
      date: date.toISOString().slice(0, 7),
      date_display: `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}`,
      GDP성장률: Math.round((2 + Math.random() * 3) * 10) / 10,
      실업률: Math.round((3 + Math.random() * 2) * 10) / 10,
      물가상승률: Math.round((1 + Math.random() * 4) * 10) / 10,
      금리: Math.round((2.5 + Math.random() * 2) * 10) / 10,
    });
  }
  return data;
}

const CHART_TYPES = ["line", "bar", "area"] as const;
type ChartType = typeof CHART_TYPES[number];

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300"];

export default function App() {
  const [chartType, setChartType] = useState<ChartType>("line");
  const [dataCount, setDataCount] = useState(12);
  const [enabledSeries, setEnabledSeries] = useState<Set<string>>(
    new Set(["GDP성장률", "실업률", "물가상승률", "금리"])
  );

  const data = useMemo(() => generateData(dataCount), [dataCount]);
  const seriesFields = ["GDP성장률", "실업률", "물가상승률", "금리"];

  const toggleSeries = (field: string) => {
    setEnabledSeries((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  const renderChart = () => {
    const activeFields = seriesFields.filter((f) => enabledSeries.has(f));

    if (chartType === "line") {
      return (
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date_display" />
          <YAxis />
          <Tooltip />
          <Legend />
          {activeFields.map((field, i) => (
            <Line key={field} type="monotone" dataKey={field} stroke={COLORS[i % COLORS.length]} />
          ))}
        </LineChart>
      );
    }

    if (chartType === "bar") {
      return (
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date_display" />
          <YAxis />
          <Tooltip />
          <Legend />
          {activeFields.map((field, i) => (
            <Bar key={field} dataKey={field} fill={COLORS[i % COLORS.length]} />
          ))}
        </BarChart>
      );
    }

    return (
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date_display" />
        <YAxis />
        <Tooltip />
        <Legend />
        {activeFields.map((field, i) => (
          <Area key={field} type="monotone" dataKey={field} fill={COLORS[i % COLORS.length]} stroke={COLORS[i % COLORS.length]} fillOpacity={0.3} />
        ))}
      </AreaChart>
    );
  };

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif", maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 20 }}>📊 Chart Widget Demo</h1>

      {/* Controls */}
      <div style={{ display: "flex", gap: 20, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <label style={{ display: "block", marginBottom: 5, fontWeight: "bold" }}>Chart Type</label>
          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value as ChartType)}
            style={{ padding: "8px 12px", fontSize: 14 }}
          >
            <option value="line">Line</option>
            <option value="bar">Bar</option>
            <option value="area">Area</option>
          </select>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 5, fontWeight: "bold" }}>Data Points</label>
          <select
            value={dataCount}
            onChange={(e) => setDataCount(Number(e.target.value))}
            style={{ padding: "8px 12px", fontSize: 14 }}
          >
            <option value={6}>6 months</option>
            <option value={12}>12 months</option>
            <option value={24}>24 months</option>
          </select>
        </div>
      </div>

      {/* Series Toggle */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", marginBottom: 10, fontWeight: "bold" }}>Series</label>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {seriesFields.map((field, i) => (
            <button
              key={field}
              onClick={() => toggleSeries(field)}
              style={{
                padding: "8px 16px",
                borderRadius: 20,
                border: "none",
                cursor: "pointer",
                backgroundColor: enabledSeries.has(field) ? COLORS[i % COLORS.length] : "#e0e0e0",
                color: enabledSeries.has(field) ? "white" : "#666",
                fontWeight: enabledSeries.has(field) ? "bold" : "normal",
              }}
            >
              {field}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div style={{ width: "100%", height: 400, border: "1px solid #ddd", borderRadius: 8, padding: 10 }}>
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>

      {/* Data Table */}
      <div style={{ marginTop: 20 }}>
        <h2>Data Preview</h2>
        <div style={{ overflowX: "auto", maxHeight: 200 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ backgroundColor: "#f5f5f5" }}>
                <th style={{ padding: 8, textAlign: "left", borderBottom: "1px solid #ddd" }}>Date</th>
                {seriesFields.map((field) => (
                  <th key={field} style={{ padding: 8, textAlign: "right", borderBottom: "1px solid #ddd" }}>{field}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 10).map((row, i) => (
                <tr key={i}>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{row.date_display}</td>
                  {seriesFields.map((field) => (
                    <td key={field} style={{ padding: 8, textAlign: "right", borderBottom: "1px solid #eee" }}>
                      {row[field as keyof typeof row]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
