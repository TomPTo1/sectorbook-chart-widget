"use client";

import React, { useState, useMemo } from "react";

// ChartWidget import를 try-catch로 감싸기
let ChartWidget: any = null;
let importError: string | null = null;

try {
  ChartWidget = require("../src/components/ChartWidget").default;
} catch (e: any) {
  importError = e.message;
}

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
      "GDP성장률": Math.round((2 + Math.random() * 3) * 10) / 10,
      "실업률": Math.round((3.5 + Math.random() * 1.5) * 10) / 10,
      "물가상승률": Math.round((2 + Math.random() * 2.5) * 10) / 10,
      "금리": Math.round((3 + Math.random() * 1.5) * 10) / 10,
    });
  }
  return data;
}

export default function App() {
  const [showChart, setShowChart] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);

  const seriesFields = ["GDP성장률", "실업률", "물가상승률", "금리"];
  const [enabledSeries] = useState<Set<string>>(new Set(seriesFields));
  const data = useMemo(() => generateMockData(12), []);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ marginBottom: 16 }}>Chart Widget Debug</h1>

      <div style={{ background: "#f0f0f0", padding: 16, borderRadius: 8, marginBottom: 16 }}>
        <p><strong>Import Status:</strong> {importError ? `❌ ${importError}` : "✅ ChartWidget imported"}</p>
        <p><strong>ChartWidget:</strong> {ChartWidget ? "✅ Loaded" : "❌ Not loaded"}</p>
        <p><strong>Data:</strong> {data.length} rows</p>
      </div>

      <button
        onClick={() => setShowChart(true)}
        style={{ padding: "12px 24px", fontSize: 16, cursor: "pointer", marginBottom: 16 }}
      >
        Load ChartWidget
      </button>

      {showChart && (
        <div style={{ border: "1px solid #ddd", padding: 16, borderRadius: 8, minHeight: 400 }}>
          {chartError ? (
            <div style={{ color: "red" }}>
              <strong>Chart Error:</strong> {chartError}
            </div>
          ) : ChartWidget ? (
            <ErrorBoundary onError={(e) => setChartError(e.message)}>
              <ChartWidget
                data={data}
                seriesFields={seriesFields}
                chartType="line"
                enabledSeries={enabledSeries}
                height={350}
              />
            </ErrorBoundary>
          ) : (
            <p>ChartWidget not available</p>
          )}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <h3>Data Preview:</h3>
        <pre style={{ background: "#f5f5f5", padding: 12, overflow: "auto", maxHeight: 200 }}>
          {JSON.stringify(data.slice(0, 3), null, 2)}
        </pre>
      </div>
    </div>
  );
}

// Simple Error Boundary
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: (e: Error) => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  render() {
    if (this.state.hasError) {
      return <div style={{ color: "red" }}>Error: {this.state.error?.message}</div>;
    }
    return this.props.children;
  }
}
