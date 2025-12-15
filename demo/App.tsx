"use client";

import React, { useState, useMemo, useCallback } from "react";
import ChartWidget from "../src/components/ChartWidget";
import { ChartLegendPanel } from "../src/components/components/chart-legend-panel";
import { expandSeriesColors, getThemeColors } from "../src/components/components/recharts-wrapper";
import type { ChartType, YAxisPlacement } from "../src/types/chart-config";
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
  const [showOutliers, setShowOutliers] = useState(false);
  const [showMissingValues, setShowMissingValues] = useState(false);

  const seriesFields = ["GDP성장률", "실업률", "물가상승률", "금리"];
  const [enabledSeries, setEnabledSeries] = useState<Set<string>>(new Set(seriesFields));

  // Tooltip 상태 (호버 시 값 표시용)
  const [tooltipPayload, setTooltipPayload] = useState<any[] | null>(null);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);

  // 혼합 차트용 상태
  const [yFieldTypes, setYFieldTypes] = useState<Record<string, "column" | "line">>({});
  const [yAxisPlacements, setYAxisPlacements] = useState<Record<string, YAxisPlacement>>({});

  const data = useMemo(() => generateMockData(dataCount), [dataCount]);

  // 테마 색상
  const themeColors = useMemo(() => getThemeColors(), []);

  // 시리즈 색상
  const seriesColors = useMemo(() => {
    const baseColors = themeColors.seriesColors.length > 0
      ? themeColors.seriesColors
      : ["hsl(12, 76%, 61%)", "hsl(173, 58%, 39%)", "hsl(197, 37%, 24%)", "hsl(43, 74%, 66%)", "hsl(27, 87%, 67%)"];
    return expandSeriesColors(baseColors, seriesFields.length);
  }, [themeColors.seriesColors, seriesFields.length]);

  // 시리즈 토글
  const toggleSeries = useCallback((field: string) => {
    setEnabledSeries((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  }, []);

  // 전체 토글
  const toggleAllSeries = useCallback((enable: boolean) => {
    if (enable) {
      setEnabledSeries(new Set(seriesFields));
    } else {
      setEnabledSeries(new Set());
    }
  }, [seriesFields]);

  // Y축 타입 변경
  const handleYFieldTypeChange = useCallback((field: string, type: "column" | "line" | "none") => {
    if (type === "none") {
      setEnabledSeries((prev) => {
        const next = new Set(prev);
        next.delete(field);
        return next;
      });
    } else {
      setEnabledSeries((prev) => {
        const next = new Set(prev);
        next.add(field);
        return next;
      });
      setYFieldTypes((prev) => ({ ...prev, [field]: type }));
    }
  }, []);

  // Y축 배치 변경
  const handleYAxisPlacementChange = useCallback((field: string, placement: YAxisPlacement) => {
    setYAxisPlacements((prev) => ({ ...prev, [field]: placement }));
  }, []);

  // 이상치/결측치 지원 여부
  const OUTLIER_UNSUPPORTED: ChartType[] = ["stacked", "stacked-100", "area", "pie", "treemap", "ranking-bar"];
  const MISSING_UNSUPPORTED: ChartType[] = ["pie", "treemap", "ranking-bar"];
  const supportsOutliers = !OUTLIER_UNSUPPORTED.includes(chartType);
  const supportsMissing = !MISSING_UNSUPPORTED.includes(chartType);

  return (
    <div style={{
      padding: 0,
      fontFamily: "system-ui, sans-serif",
      background: "#f8fafc",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* 헤더 */}
      <div style={{
        padding: "16px 24px",
        background: "white",
        borderBottom: "1px solid rgba(0, 0, 0, 0.06)",
      }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#1e293b" }}>
          Sectorbook Chart Widget - Step 3 Demo
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "#64748b" }}>
          Chart + Legend Panel 통합 데모
        </p>
      </div>

      {/* 데이터 컨트롤 */}
      <div style={{
        padding: "12px 24px",
        background: "white",
        borderBottom: "1px solid rgba(0, 0, 0, 0.06)",
        display: "flex",
        gap: 16,
        alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: "#475569" }}>Data Points:</label>
          <select
            value={dataCount}
            onChange={(e) => setDataCount(Number(e.target.value))}
            style={{ padding: "6px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13 }}
          >
            <option value={6}>6개월</option>
            <option value={12}>12개월</option>
            <option value={24}>24개월</option>
          </select>
        </div>
      </div>

      {/* 메인 콘텐츠: Chart + Legend Panel */}
      <div style={{
        flex: 1,
        display: "flex",
        gap: 0,
        padding: 24,
        minHeight: 0,
      }}>
        {/* 좌측: Chart */}
        <div style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          background: "#ffffff",
          border: "1px solid rgba(0, 0, 0, 0.06)",
        }}>
          <ErrorBoundary>
            <ChartWidget
              data={data}
              seriesFields={seriesFields}
              chartType={chartType}
              enabledSeries={enabledSeries}
              height="100%"
              showOutliers={showOutliers}
              yFieldTypes={yFieldTypes}
              yAxisPlacements={yAxisPlacements}
              onTooltipChange={(payload) => setTooltipPayload(payload)}
              onHoveredLabelChange={(label) => setHoveredLabel(label)}
            />
          </ErrorBoundary>
        </div>

        {/* 우측: Legend Panel */}
        <div style={{
          width: 300,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          background: "#ffffff",
          border: "1px solid rgba(0, 0, 0, 0.06)",
          borderLeft: "none",
        }}>
          <ChartLegendPanel
            layout="sidePanel"
            seriesFields={seriesFields}
            seriesColors={seriesColors}
            enabledSeries={enabledSeries}
            tooltipPayload={tooltipPayload}
            hoveredLabel={hoveredLabel}
            analysisResult={null}
            onSeriesToggle={toggleSeries}
            onToggleAll={toggleAllSeries}
            chartType={chartType}
            yFieldTypes={yFieldTypes}
            yAxisPlacements={yAxisPlacements}
            onYFieldTypeChange={handleYFieldTypeChange}
            onYAxisPlacementChange={handleYAxisPlacementChange}
            // 차트 제어판 props
            allowedChartTypes={AVAILABLE_CHART_TYPES}
            onChartTypeChange={setChartType}
            showOutliers={showOutliers}
            showMissingValues={showMissingValues}
            onShowOutliersChange={setShowOutliers}
            onShowMissingValuesChange={setShowMissingValues}
            supportsOutliers={supportsOutliers}
            supportsMissing={supportsMissing}
          />
        </div>
      </div>
    </div>
  );
}
