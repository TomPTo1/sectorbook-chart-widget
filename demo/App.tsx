"use client";

import React, { useState } from "react";
import {
  ChartWidget,
  useChartState,
  generateFinancialData,
  generateDataWithOutliers,
  generateSimpleTimeSeries,
  generateCategoryData,
  CHART_TYPE_TO_NAME,
  type ChartType,
} from "../src";

const CHART_TYPES: ChartType[] = [
  "line", "area", "column", "stacked", "stacked-100",
  "mixed", "dual-axis", "pie", "treemap", "ranking-bar"
];

export default function App() {
  const [dataType, setDataType] = useState<"financial" | "outliers" | "simple" | "category">("financial");

  const data = React.useMemo(() => {
    switch (dataType) {
      case "financial":
        return generateFinancialData(24);
      case "outliers":
        return generateDataWithOutliers(30);
      case "simple":
        return generateSimpleTimeSeries(4, 12);
      case "category":
        return generateCategoryData();
      default:
        return generateFinancialData(24);
    }
  }, [dataType]);

  const seriesFields = React.useMemo(() => {
    if (data.length === 0) return [];
    const firstRow = data[0];
    return Object.keys(firstRow).filter(
      (key) => key !== "date" && key !== "date_display" && typeof firstRow[key] === "number"
    );
  }, [data]);

  const chartState = useChartState({
    seriesFields,
    initialChartType: "line",
  });

  return (
    <div className="min-h-screen bg-background text-foreground p-4">
      <h1 className="text-2xl font-bold mb-4">Chart Widget Demo</h1>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-4">
        {/* Data Type */}
        <div>
          <label className="block text-sm font-medium mb-1">Data Type</label>
          <select
            value={dataType}
            onChange={(e) => setDataType(e.target.value as any)}
            className="px-3 py-2 border rounded-md bg-background"
          >
            <option value="financial">Financial</option>
            <option value="outliers">With Outliers</option>
            <option value="simple">Simple</option>
            <option value="category">Category</option>
          </select>
        </div>

        {/* Chart Type */}
        <div>
          <label className="block text-sm font-medium mb-1">Chart Type</label>
          <select
            value={chartState.chartType}
            onChange={(e) => chartState.setChartType(e.target.value as ChartType)}
            className="px-3 py-2 border rounded-md bg-background"
          >
            {CHART_TYPES.map((type) => (
              <option key={type} value={type}>
                {CHART_TYPE_TO_NAME[type]}
              </option>
            ))}
          </select>
        </div>

        {/* Options */}
        <div>
          <label className="block text-sm font-medium mb-1">Options</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={chartState.showOutliers}
                onChange={(e) => chartState.setShowOutliers(e.target.checked)}
              />
              <span className="text-sm">Outliers</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={chartState.showMissingValues}
                onChange={(e) => chartState.setShowMissingValues(e.target.checked)}
              />
              <span className="text-sm">Missing</span>
            </label>
          </div>
        </div>
      </div>

      {/* Series Toggle */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Series</label>
        <div className="flex flex-wrap gap-2">
          {seriesFields.map((field) => (
            <button
              key={field}
              onClick={() => chartState.toggleSeries(field)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                chartState.enabledSeries.has(field)
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
              }`}
            >
              {field}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="border rounded-lg p-4 bg-card" style={{ height: 400 }}>
        <ChartWidget
          data={data}
          seriesFields={seriesFields}
          chartType={chartState.chartType}
          enabledSeries={chartState.enabledSeries}
          showOutliers={chartState.showOutliers}
          showMissingValues={chartState.showMissingValues}
          yFieldTypes={Object.fromEntries(chartState.yFieldTypes)}
          yAxisPlacements={Object.fromEntries(chartState.yAxisPlacements)}
          height="100%"
        />
      </div>

      {/* Data Preview */}
      <div className="mt-4">
        <h2 className="text-lg font-semibold mb-2">Data Preview</h2>
        <div className="overflow-auto max-h-48 border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-muted sticky top-0">
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
