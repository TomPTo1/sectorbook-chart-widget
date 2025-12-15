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
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-800 mb-6">
          Sectorbook Chart Widget Demo
        </h1>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4 flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Chart Type
            </label>
            <select
              value={chartType}
              onChange={(e) => setChartType(e.target.value as ChartType)}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              {AVAILABLE_CHART_TYPES.map((type) => (
                <option key={type} value={type}>
                  {CHART_TYPE_TO_NAME[type] || type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Data Points
            </label>
            <select
              value={dataCount}
              onChange={(e) => setDataCount(Number(e.target.value))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              <option value={6}>6개월</option>
              <option value={12}>12개월</option>
              <option value={24}>24개월</option>
              <option value={36}>36개월</option>
            </select>
          </div>
        </div>

        {/* Series Toggle */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <label className="block text-sm font-medium text-slate-600 mb-2">
            Series
          </label>
          <div className="flex flex-wrap gap-2">
            {seriesFields.map((field) => (
              <button
                key={field}
                onClick={() => toggleSeries(field)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  enabledSeries.has(field)
                    ? "bg-blue-500 text-white"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {field}
              </button>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div className="bg-white rounded-lg shadow-sm p-4" style={{ height: 450 }}>
          <ChartWidget
            data={data}
            seriesFields={seriesFields}
            chartType={chartType}
            enabledSeries={enabledSeries}
            height="100%"
          />
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-lg shadow-sm p-4 mt-4">
          <h2 className="text-lg font-semibold text-slate-700 mb-3">Data Preview</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="px-4 py-2 text-left text-slate-600">Date</th>
                  {seriesFields.map((field) => (
                    <th key={field} className="px-4 py-2 text-right text-slate-600">{field}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 8).map((row, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-4 py-2 text-slate-700">{row.date_display}</td>
                    {seriesFields.map((field) => (
                      <td key={field} className="px-4 py-2 text-right text-slate-600">
                        {row[field] != null ? Number(row[field]).toFixed(1) : "-"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
