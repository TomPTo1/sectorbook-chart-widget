"use client";

import React, { useState, useMemo } from "react";
import ChartWidget from "../src/components/ChartWidget";
import type { ChartType, ChartDataRow } from "../src/types/chart-config";
import { CHART_TYPE_TO_NAME } from "../src/types/chart-config";

// Mock 데이터 생성
function generateMockData(count: number): ChartDataRow[] {
  const data: ChartDataRow[] = [];
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
  "line", "area", "column", "stacked", "stacked-100",
  "mixed", "dual-axis", "pie", "treemap", "ranking-bar"
];

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"];

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

  const styles = {
    container: {
      minHeight: "100vh",
      padding: 24,
      background: "#f8fafc",
    } as React.CSSProperties,
    inner: {
      maxWidth: 1200,
      margin: "0 auto",
    } as React.CSSProperties,
    title: {
      fontSize: 24,
      fontWeight: "bold",
      color: "#1e293b",
      marginBottom: 24,
    } as React.CSSProperties,
    card: {
      background: "white",
      borderRadius: 8,
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      padding: 16,
      marginBottom: 16,
    } as React.CSSProperties,
    row: {
      display: "flex",
      gap: 20,
      flexWrap: "wrap" as const,
    } as React.CSSProperties,
    label: {
      display: "block",
      fontSize: 14,
      fontWeight: 500,
      color: "#475569",
      marginBottom: 6,
    } as React.CSSProperties,
    select: {
      padding: "8px 12px",
      border: "1px solid #cbd5e1",
      borderRadius: 6,
      fontSize: 14,
    } as React.CSSProperties,
    seriesRow: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap" as const,
    } as React.CSSProperties,
    chartContainer: {
      height: 450,
    } as React.CSSProperties,
  };

  const getButtonStyle = (field: string, index: number): React.CSSProperties => ({
    padding: "8px 16px",
    borderRadius: 20,
    border: "none",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: enabledSeries.has(field) ? 600 : 400,
    background: enabledSeries.has(field) ? COLORS[index % COLORS.length] : "#e2e8f0",
    color: enabledSeries.has(field) ? "white" : "#64748b",
  });

  return (
    <div style={styles.container}>
      <div style={styles.inner}>
        <h1 style={styles.title}>Sectorbook Chart Widget Demo</h1>

        {/* Controls */}
        <div style={{ ...styles.card, ...styles.row }}>
          <div>
            <label style={styles.label}>Chart Type</label>
            <select
              value={chartType}
              onChange={(e) => setChartType(e.target.value as ChartType)}
              style={styles.select}
            >
              {AVAILABLE_CHART_TYPES.map((type) => (
                <option key={type} value={type}>
                  {CHART_TYPE_TO_NAME[type] || type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={styles.label}>Data Points</label>
            <select
              value={dataCount}
              onChange={(e) => setDataCount(Number(e.target.value))}
              style={styles.select}
            >
              <option value={6}>6개월</option>
              <option value={12}>12개월</option>
              <option value={24}>24개월</option>
              <option value={36}>36개월</option>
            </select>
          </div>
        </div>

        {/* Series Toggle */}
        <div style={styles.card}>
          <label style={styles.label}>Series</label>
          <div style={styles.seriesRow}>
            {seriesFields.map((field, i) => (
              <button
                key={field}
                onClick={() => toggleSeries(field)}
                style={getButtonStyle(field, i)}
              >
                {field}
              </button>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div style={{ ...styles.card, ...styles.chartContainer }}>
          <ChartWidget
            data={data}
            seriesFields={seriesFields}
            chartType={chartType}
            enabledSeries={enabledSeries}
            height="100%"
          />
        </div>
      </div>
    </div>
  );
}
