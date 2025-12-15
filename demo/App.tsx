"use client";

import React, { useState, useMemo } from "react";
import ChartWidget from "../src/components/ChartWidget";
import type { ChartType } from "../src/types/chart-config";
import { CHART_TYPE_TO_NAME } from "../src/types/chart-config";

// Mock 데이터 생성
function generateMockData(count: number) {
  const data = [];
  const baseDate = new Date(2024, 0, 1);

  for (let i = 0; i < count; i++) {
    const date = new Date(baseDate);
    date.setMonth(date.getMonth() + i);

    data.push({
      date: date.toISOString().slice(0, 7),
      date_display: `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}`,
      "GDP성장률": Math.round((2 + Math.random() * 3 + Math.sin(i / 3) * 1.5) * 10) / 10,
      "실업률": Math.round((3.5 + Math.random() * 1.5 - Math.cos(i / 4) * 0.8) * 10) / 10,
      "물가상승률": Math.round((2 + Math.random() * 2.5 + Math.sin(i / 2) * 1) * 10) / 10,
      "금리": Math.round((3 + Math.random() * 1.5) * 10) / 10,
    });
  }
  return data;
}

const AVAILABLE_CHART_TYPES: ChartType[] = [
  "line", "area", "column", "stacked", "stacked-100", "pie", "treemap", "ranking-bar"
];

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"];

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: "red", padding: 20 }}>
          <strong>Chart Error:</strong> {this.state.error?.message}
          <pre style={{ fontSize: 12, marginTop: 10 }}>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [chartType, setChartType] = useState<ChartType>("line");
  const [dataCount, setDataCount] = useState(12);

  const seriesFields = ["GDP성장률", "실업률", "물가상승률", "금리"];
  const [enabledSeries, setEnabledSeries] = useState<Set<string>>(new Set(seriesFields));

  const data = useMemo(() => generateMockData(dataCount), [dataCount]);

  const toggleSeries = (field: string) => {
    setEnabledSeries((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif", background: "#f8fafc", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <h1 style={{ marginBottom: 20, color: "#1e293b" }}>Sectorbook Chart Widget Demo</h1>

        {/* Controls */}
        <div style={{ background: "white", padding: 16, borderRadius: 8, marginBottom: 16, display: "flex", gap: 20, flexWrap: "wrap" }}>
          <div>
            <label style={{ display: "block", marginBottom: 6, fontWeight: 500, color: "#475569" }}>Chart Type</label>
            <select
              value={chartType}
              onChange={(e) => setChartType(e.target.value as ChartType)}
              style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 6 }}
            >
              {AVAILABLE_CHART_TYPES.map((type) => (
                <option key={type} value={type}>
                  {CHART_TYPE_TO_NAME[type] || type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6, fontWeight: 500, color: "#475569" }}>Data Points</label>
            <select
              value={dataCount}
              onChange={(e) => setDataCount(Number(e.target.value))}
              style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 6 }}
            >
              <option value={6}>6개월</option>
              <option value={12}>12개월</option>
              <option value={24}>24개월</option>
            </select>
          </div>
        </div>

        {/* Series Toggle */}
        <div style={{ background: "white", padding: 16, borderRadius: 8, marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 10, fontWeight: 500, color: "#475569" }}>Series</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {seriesFields.map((field, i) => (
              <button
                key={field}
                onClick={() => toggleSeries(field)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 20,
                  border: "none",
                  cursor: "pointer",
                  background: enabledSeries.has(field) ? COLORS[i % COLORS.length] : "#e2e8f0",
                  color: enabledSeries.has(field) ? "white" : "#64748b",
                  fontWeight: enabledSeries.has(field) ? 600 : 400,
                }}
              >
                {field}
              </button>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div style={{ background: "white", padding: 16, borderRadius: 8, height: 450 }}>
          <ErrorBoundary>
            <ChartWidget
              data={data}
              seriesFields={seriesFields}
              chartType={chartType}
              enabledSeries={enabledSeries}
              height="100%"
            />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
