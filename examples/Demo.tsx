"use client";

import React, { useState } from "react";
import {
  ChartWidget,
  useChartState,
  generateFinancialData,
  generateDataWithOutliers,
  generateSimpleTimeSeries,
  CHART_TYPE_TO_NAME,
  type ChartType,
} from "../src";

// ============================================================
// Demo Component
// ============================================================

export function ChartDemo() {
  // Generate mock data
  const [dataType, setDataType] = useState<"financial" | "outliers" | "simple">("financial");

  const data = React.useMemo(() => {
    switch (dataType) {
      case "financial":
        return generateFinancialData(24);
      case "outliers":
        return generateDataWithOutliers(30);
      case "simple":
        return generateSimpleTimeSeries(4, 12);
      default:
        return generateFinancialData(24);
    }
  }, [dataType]);

  // Get series fields from data
  const seriesFields = React.useMemo(() => {
    if (data.length === 0) return [];
    const firstRow = data[0];
    return Object.keys(firstRow).filter(
      (key) => key !== "date" && key !== "date_display" && typeof firstRow[key] === "number"
    );
  }, [data]);

  // Chart state management
  const chartState = useChartState({
    seriesFields,
    initialChartType: "line",
  });

  // Available chart types
  const chartTypes: ChartType[] = [
    "line", "area", "column", "stacked", "mixed", "dual-axis", "pie"
  ];

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Chart Widget Demo</h1>

      {/* Controls */}
      <div className="flex flex-wrap gap-4">
        {/* Data Type Selector */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Data Type</label>
          <select
            value={dataType}
            onChange={(e) => setDataType(e.target.value as any)}
            className="block w-40 px-3 py-2 border rounded-md"
          >
            <option value="financial">Financial</option>
            <option value="outliers">With Outliers</option>
            <option value="simple">Simple</option>
          </select>
        </div>

        {/* Chart Type Selector */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Chart Type</label>
          <select
            value={chartState.chartType}
            onChange={(e) => chartState.setChartType(e.target.value as ChartType)}
            className="block w-40 px-3 py-2 border rounded-md"
          >
            {chartTypes.map((type) => (
              <option key={type} value={type}>
                {CHART_TYPE_TO_NAME[type]}
              </option>
            ))}
          </select>
        </div>

        {/* Outliers Toggle */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Options</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={chartState.showOutliers}
                onChange={(e) => chartState.setShowOutliers(e.target.checked)}
              />
              <span className="text-sm">Show Outliers</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={chartState.showMissingValues}
                onChange={(e) => chartState.setShowMissingValues(e.target.checked)}
              />
              <span className="text-sm">Show Missing</span>
            </label>
          </div>
        </div>
      </div>

      {/* Series Toggle */}
      <div className="space-y-1">
        <label className="text-sm font-medium">Series</label>
        <div className="flex flex-wrap gap-2">
          {seriesFields.map((field) => (
            <label
              key={field}
              className={`px-3 py-1 rounded-full cursor-pointer text-sm ${
                chartState.enabledSeries.has(field)
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-600"
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={chartState.enabledSeries.has(field)}
                onChange={() => chartState.toggleSeries(field)}
              />
              {field}
            </label>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="border rounded-lg p-4 bg-white" style={{ height: 400 }}>
        <ChartWidget
          data={data}
          seriesFields={seriesFields}
          chartType={chartState.chartType}
          enabledSeries={chartState.enabledSeries}
          showOutliers={chartState.showOutliers}
          showMissingValues={chartState.showMissingValues}
          yFieldTypes={chartState.yFieldTypes}
          yAxisPlacements={chartState.yAxisPlacements}
          height="100%"
        />
      </div>

      {/* Data Preview */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Data Preview</h2>
        <div className="overflow-auto max-h-48 border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                {seriesFields.map((field) => (
                  <th key={field} className="px-3 py-2 text-right">{field}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 10).map((row, i) => (
                <tr key={i} className="border-t">
                  <td className="px-3 py-2">{row.date_display}</td>
                  {seriesFields.map((field) => (
                    <td key={field} className="px-3 py-2 text-right">
                      {row[field] != null ? Number(row[field]).toLocaleString() : "-"}
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

export default ChartDemo;
