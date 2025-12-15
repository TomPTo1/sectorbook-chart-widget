"use client";

import React, { useState, useMemo, useCallback } from "react";
import ChartWidget from "../src/components/ChartWidget";
import { ChartLegendPanel } from "../src/components/components/chart-legend-panel";
import { expandSeriesColors, getThemeColors } from "../src/components/components/recharts-wrapper";
import type { ChartType, YAxisPlacement } from "../src/types/chart-config";

// 모든 차트 타입 (geo-grid 제외 - 특수 데이터 필요)
const ALL_CHART_TYPES: ChartType[] = [
  "line", "area", "area-100", "stacked-area", "synced-area",
  "column", "mixed", "stacked", "stacked-100", "stacked-grouped", "dual-axis",
  "pie", "two-level-pie", "treemap", "multi-level-treemap",
  "ranking-bar", "regression-scatter"
];

// 이상치가 포함된 Mock 데이터 생성
function generateMockDataWithOutliers(count: number) {
  const data = [];
  const baseDate = new Date(2024, 0, 1);

  for (let i = 0; i < count; i++) {
    const date = new Date(baseDate);
    date.setMonth(date.getMonth() + i);

    // 기본 값
    let gdp = Math.round((2 + Math.random() * 3 + Math.sin(i / 3) * 1.5) * 10) / 10;
    let unemployment = Math.round((3.5 + Math.random() * 1.5 - Math.cos(i / 4) * 0.8) * 10) / 10;
    let inflation = Math.round((2 + Math.random() * 2.5 + Math.sin(i / 2) * 1) * 10) / 10;
    let interestRate = Math.round((3 + Math.random() * 1.5) * 10) / 10;

    // 이상치 추가 (3번째, 7번째, 11번째 데이터에 이상치)
    if (i === 2) gdp = 12.5; // 상한 이상치
    if (i === 6) unemployment = 8.9; // 상한 이상치
    if (i === 10) inflation = -2.1; // 하한 이상치

    data.push({
      date: date.toISOString().slice(0, 7),
      date_display: `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}`,
      "GDP성장률": gdp,
      "실업률": unemployment,
      "물가상승률": inflation,
      "금리": interestRate,
    });
  }
  return data;
}

// Error Boundary
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
        <div className="text-red-500 p-5">
          <strong>Chart Error:</strong> {this.state.error?.message}
          <pre className="text-xs mt-2">{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [chartType, setChartType] = useState<ChartType>("line");
  const [dataCount] = useState(12);
  const [showOutliers, setShowOutliers] = useState(false);
  const [showMissingValues, setShowMissingValues] = useState(false);

  const seriesFields = ["GDP성장률", "실업률", "물가상승률", "금리"];
  const [enabledSeries, setEnabledSeries] = useState<Set<string>>(new Set(seriesFields));

  // Tooltip 상태
  const [tooltipPayload, setTooltipPayload] = useState<any[] | null>(null);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);

  // 혼합/이중축 차트용 상태
  const [yFieldTypes, setYFieldTypes] = useState<Record<string, "column" | "line">>({
    "GDP성장률": "line",
    "실업률": "column",
    "물가상승률": "line",
    "금리": "column",
  });
  const [yAxisPlacements, setYAxisPlacements] = useState<Record<string, YAxisPlacement>>({
    "GDP성장률": "left",
    "실업률": "left",
    "물가상승률": "right",
    "금리": "right",
  });

  // 그룹형 누적막대용 상태
  const [groupCount, setGroupCount] = useState(2);
  const [seriesGroupAssignments, setSeriesGroupAssignments] = useState<Record<string, number>>({
    "GDP성장률": 1,
    "실업률": 1,
    "물가상승률": 2,
    "금리": 2,
  });

  // 동기화 영역 차트용
  const [syncedAreaLeftField, setSyncedAreaLeftField] = useState<string | null>("GDP성장률");
  const [syncedAreaRightField, setSyncedAreaRightField] = useState<string | null>("실업률");

  // 회귀 산점도용
  const [regressionScatterXField, setRegressionScatterXField] = useState<string | null>("GDP성장률");
  const [regressionScatterYField, setRegressionScatterYField] = useState<string | null>("실업률");
  const [regressionStats, setRegressionStats] = useState<{ r2: number } | null>(null);

  // 트리맵 통계
  const [treemapStats, setTreemapStats] = useState<any>(null);

  const data = useMemo(() => generateMockDataWithOutliers(dataCount), [dataCount]);

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

  // 그룹 개수 변경
  const handleGroupCountChange = useCallback((count: number) => {
    setGroupCount(count);
  }, []);

  // 시리즈 그룹 변경
  const handleSeriesGroupChange = useCallback((field: string, group: number) => {
    setSeriesGroupAssignments((prev) => ({ ...prev, [field]: group }));
  }, []);

  // 동기화 영역 필드 변경
  const handleSyncedAreaFieldChange = useCallback((position: 'left' | 'right', field: string) => {
    if (position === 'left') setSyncedAreaLeftField(field);
    else setSyncedAreaRightField(field);
  }, []);

  // 회귀 산점도 필드 변경
  const handleRegressionScatterFieldChange = useCallback((axis: 'x' | 'y', field: string) => {
    if (axis === 'x') setRegressionScatterXField(field);
    else setRegressionScatterYField(field);
  }, []);

  // 이상치/결측치 지원 여부
  const OUTLIER_UNSUPPORTED: ChartType[] = ["stacked", "stacked-100", "stacked-grouped", "area", "area-100", "stacked-area", "synced-area", "pie", "two-level-pie", "treemap", "multi-level-treemap", "ranking-bar", "geo-grid", "regression-scatter"];
  const MISSING_UNSUPPORTED: ChartType[] = ["pie", "two-level-pie", "treemap", "multi-level-treemap", "ranking-bar", "stacked-area", "synced-area", "geo-grid", "regression-scatter"];
  const supportsOutliers = !OUTLIER_UNSUPPORTED.includes(chartType);
  const supportsMissing = !MISSING_UNSUPPORTED.includes(chartType);

  // 랭킹 데이터
  const rankingData = useMemo(() => {
    if (chartType !== "ranking-bar") return null;
    const lastData = data[data.length - 1];
    return seriesFields
      .map((field) => ({
        name: field,
        value: typeof lastData?.[field] === "number" ? lastData[field] as number : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [chartType, data, seriesFields]);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* 메인 콘텐츠: Chart + Legend Panel */}
      <div className="flex-1 flex min-h-0">
        {/* 좌측: Chart */}
        <div className="flex-1 min-w-0 flex flex-col border-r">
          {/* 차트 헤더 */}
          <div className="px-4 py-3 border-b">
            <h3 className="font-medium text-sm">경제 지표 차트</h3>
          </div>
          {/* 차트 영역 */}
          <div className="flex-1 min-h-0 p-4">
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
                seriesGroupAssignments={seriesGroupAssignments}
                syncedAreaLeftField={syncedAreaLeftField}
                syncedAreaRightField={syncedAreaRightField}
                regressionScatterXField={regressionScatterXField}
                regressionScatterYField={regressionScatterYField}
                onTooltipChange={(payload) => setTooltipPayload(payload)}
                onHoveredLabelChange={(label) => setHoveredLabel(label)}
                onTreemapStatsChange={setTreemapStats}
                onRegressionStatsChange={(stats) => stats && setRegressionStats({ r2: stats.rSquared })}
              />
            </ErrorBoundary>
          </div>
        </div>

        {/* 우측: Legend Panel (300px) */}
        <div className="w-[300px] flex-shrink-0 flex flex-col bg-card">
          <ChartLegendPanel
            layout="sidePanel"
            seriesFields={seriesFields}
            seriesColors={seriesColors}
            enabledSeries={enabledSeries}
            tooltipPayload={tooltipPayload}
            hoveredLabel={hoveredLabel}
            analysisResult={null}
            rankingData={rankingData}
            onSeriesToggle={toggleSeries}
            onToggleAll={toggleAllSeries}
            chartType={chartType}
            yFieldTypes={yFieldTypes}
            yAxisPlacements={yAxisPlacements}
            onYFieldTypeChange={handleYFieldTypeChange}
            onYAxisPlacementChange={handleYAxisPlacementChange}
            // 그룹형 누적막대
            groupCount={groupCount}
            seriesGroupAssignments={seriesGroupAssignments}
            onGroupCountChange={handleGroupCountChange}
            onSeriesGroupChange={handleSeriesGroupChange}
            // 동기화 영역 차트
            syncedAreaLeftField={syncedAreaLeftField || undefined}
            syncedAreaRightField={syncedAreaRightField || undefined}
            onSyncedAreaFieldChange={handleSyncedAreaFieldChange}
            // 회귀 산점도
            regressionScatterXField={regressionScatterXField || undefined}
            regressionScatterYField={regressionScatterYField || undefined}
            onRegressionScatterFieldChange={handleRegressionScatterFieldChange}
            regressionStats={regressionStats}
            // 트리맵 통계
            treemapStats={treemapStats}
            // 차트 제어판 props
            allowedChartTypes={ALL_CHART_TYPES}
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
