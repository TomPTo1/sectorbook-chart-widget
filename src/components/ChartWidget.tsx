"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import type {
  ChartType,
  ChartDataRow,
  YAxisPlacement,
  ExtendedDataAnalysisResult
} from "../types/chart-config";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { RechartsWrapper, expandSeriesColors, getThemeColors, getAxisLineColor } from "./components/recharts-wrapper";
import { RechartsPieWrapper } from "./components/recharts-pie-wrapper";
import { RechartsTwoLevelPieWrapper, TWO_LEVEL_PIE_COLORS } from "./components/recharts-two-level-pie-wrapper";
import { RechartsTreemapWrapper } from "./components/recharts-treemap-wrapper";
import { RechartsMultiLevelTreemapWrapper, MULTI_LEVEL_TREEMAP_COLORS } from "./components/recharts-multilevel-treemap-wrapper";
import { RechartsRankingBarWrapper } from "./components/recharts-ranking-bar-wrapper";
import { RechartsRegressionScatterWrapper } from "./components/recharts-regression-scatter-wrapper";
import { RechartsSplitWrapper } from "./components/recharts-split-wrapper";
import {
  calculateSeriesSums,
  calculateTwoLevelPieData,
  calculateTreemapData,
  analyzeDataQualityExtended,
  outliersToScatterData,
} from "./utils/recharts-adapter";

// 이상치 표시 미지원 차트 타입
const OUTLIER_UNSUPPORTED_CHARTS: ChartType[] = [
  "stacked", "stacked-100", "stacked-grouped",
  "area", "area-100", "stacked-area", "synced-area",
  "pie", "two-level-pie",
  "treemap", "multi-level-treemap",
  "ranking-bar", "geo-grid", "regression-scatter",
];

// 결측치 표시 미지원 차트 타입
const MISSING_UNSUPPORTED_CHARTS: ChartType[] = [
  "pie", "two-level-pie",
  "treemap", "multi-level-treemap",
  "ranking-bar", "stacked-area", "synced-area",
  "geo-grid", "regression-scatter",
];

// ============================================================
// Props Interface
// ============================================================

export interface ChartWidgetProps {
  // Required Data
  data: ChartDataRow[];
  seriesFields: string[];

  // Chart Configuration
  chartType: ChartType;
  enabledSeries: Set<string>;

  // Optional Features
  showOutliers?: boolean;
  showMissingValues?: boolean;

  // Optional Axis Configuration
  yFieldTypes?: Map<string, "line" | "column">;
  yAxisPlacements?: Map<string, YAxisPlacement>;

  // Optional Grouping (for stacked-grouped)
  groupCount?: number;
  seriesGroupAssignments?: Map<string, number>;

  // Optional Synced Area Configuration
  syncedAreaLeftField?: string | null;
  syncedAreaRightField?: string | null;

  // Optional Regression Scatter Configuration
  regressionScatterXField?: string | null;
  regressionScatterYField?: string | null;

  // Optional Scenario Info
  scenario?: {
    id: string;
    name: string;
    unit?: string;
  } | null;

  // Optional Callbacks
  onTooltipChange?: (payload: any[] | null) => void;
  onHoveredLabelChange?: (label: string | null) => void;
  onTreemapStatsChange?: (stats: { total: number; selected: number; path: string[] } | null) => void;
  onRegressionStatsChange?: (stats: { rSquared: number; slope: number; intercept: number; outlierCount: number } | null) => void;

  // Optional Styling
  className?: string;
  height?: number | string;
}

// ============================================================
// ChartWidget Component
// ============================================================

export function ChartWidget({
  data,
  seriesFields,
  chartType,
  enabledSeries,
  showOutliers = false,
  showMissingValues = false,
  yFieldTypes = new Map(),
  yAxisPlacements = new Map(),
  groupCount = 2,
  seriesGroupAssignments = new Map(),
  syncedAreaLeftField = null,
  syncedAreaRightField = null,
  regressionScatterXField = null,
  regressionScatterYField = null,
  scenario = null,
  onTooltipChange,
  onHoveredLabelChange,
  onTreemapStatsChange,
  onRegressionStatsChange,
  className,
  height = "100%",
}: ChartWidgetProps) {
  // 테마 색상 (CSS 변수에서 동적으로 가져옴)
  const [themeColors, setThemeColors] = useState(getThemeColors());

  // 회귀 산점도 이상치 개수
  const [regressionOutlierCount, setRegressionOutlierCount] = useState<number>(0);

  // 차트 컨테이너 높이 측정
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartHeight, setChartHeight] = useState<number>(400);

  // 차트 컨테이너 높이 측정
  useEffect(() => {
    const updateHeight = () => {
      if (chartContainerRef.current) {
        const containerHeight = chartContainerRef.current.clientHeight;
        if (containerHeight > 0) {
          setChartHeight(containerHeight);
        }
      }
    };

    updateHeight();
    const resizeObserver = new ResizeObserver(updateHeight);
    if (chartContainerRef.current) {
      resizeObserver.observe(chartContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // 테마 색상 업데이트
  useEffect(() => {
    const updateColors = () => setThemeColors(getThemeColors());
    updateColors();

    const observer = new MutationObserver(updateColors);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"]
    });

    return () => observer.disconnect();
  }, []);

  // 시리즈 색상 확장
  const seriesColors = useMemo(
    () => expandSeriesColors(themeColors.seriesColors, seriesFields.length),
    [themeColors.seriesColors, seriesFields.length]
  );

  // 데이터가 없을 때 표시
  if (!data || data.length === 0) {
    return (
      <div
        ref={chartContainerRef}
        className={`flex items-center justify-center h-full text-muted-foreground ${className || ""}`}
        style={{ height }}
      >
        데이터 없음
      </div>
    );
  }

  // 활성화된 시리즈만 필터링
  const activeSeriesFields = seriesFields.filter(f => enabledSeries.has(f));

  // 이상치 지원 여부
  const supportsOutliers = !OUTLIER_UNSUPPORTED_CHARTS.includes(chartType);
  const supportsMissing = !MISSING_UNSUPPORTED_CHARTS.includes(chartType);

  const effectiveShowOutliers = showOutliers && supportsOutliers;
  const effectiveShowMissing = showMissingValues && supportsMissing;

  // 이상치/결측치 분석
  const analysisResult = useMemo(() => {
    if (!effectiveShowOutliers && !effectiveShowMissing) {
      return null;
    }
    return analyzeDataQualityExtended(
      data,
      activeSeriesFields,
      effectiveShowOutliers
    );
  }, [data, activeSeriesFields, effectiveShowOutliers, effectiveShowMissing]);

  // 이상치 scatter 데이터
  const outlierScatterData = useMemo(() => {
    if (!analysisResult?.outliers || !effectiveShowOutliers) return [];
    return outliersToScatterData(analysisResult.outliers);
  }, [analysisResult, effectiveShowOutliers]);

  // 파이 차트 데이터
  const pieChartData = useMemo(() => {
    if (chartType !== "pie") return null;
    return calculateSeriesSums(data, activeSeriesFields, seriesColors);
  }, [data, activeSeriesFields, seriesColors, chartType]);

  // 2단계 파이 차트 데이터
  const twoLevelPieData = useMemo(() => {
    if (chartType !== "two-level-pie") return null;
    return calculateTwoLevelPieData(data, activeSeriesFields);
  }, [data, activeSeriesFields, chartType]);

  // 트리맵 데이터
  const treemapData = useMemo(() => {
    if (chartType !== "treemap") return null;
    return calculateTreemapData(data, activeSeriesFields);
  }, [data, activeSeriesFields, chartType]);

  // 툴팁 핸들러
  const handleTooltipChange = (payload: any[] | null) => {
    onTooltipChange?.(payload);
  };

  const handleHoveredLabelChange = (label: string | null) => {
    onHoveredLabelChange?.(label);
  };

  // 렌더링
  const renderChart = () => {
    // 분할 차트 (이상치가 있는 경우)
    if (effectiveShowOutliers && analysisResult?.classifiedData) {
      return (
        <RechartsSplitWrapper
          data={data}
          analysisResult={analysisResult}
          seriesFields={activeSeriesFields}
          enabledSeries={enabledSeries}
          seriesColors={seriesColors}
          chartType={chartType}
          themeColors={themeColors}
          chartHeight={chartHeight}
          yFieldTypes={yFieldTypes}
          yAxisPlacements={yAxisPlacements}
          groupCount={groupCount}
          seriesGroupAssignments={seriesGroupAssignments}
          showMissingValues={effectiveShowMissing}
          onTooltipChange={handleTooltipChange}
          onHoveredLabelChange={handleHoveredLabelChange}
        />
      );
    }

    // 파이 차트
    if (chartType === "pie" && pieChartData) {
      return (
        <RechartsPieWrapper
          data={pieChartData}
          seriesFields={activeSeriesFields}
          enabledSeries={enabledSeries}
          seriesColors={seriesColors}
          onTooltipChange={handleTooltipChange}
        />
      );
    }

    // 2단계 파이 차트
    if (chartType === "two-level-pie" && twoLevelPieData) {
      return (
        <RechartsTwoLevelPieWrapper
          data={twoLevelPieData}
          seriesFields={activeSeriesFields}
          enabledSeries={enabledSeries}
          colors={TWO_LEVEL_PIE_COLORS}
          onTooltipChange={handleTooltipChange}
        />
      );
    }

    // 트리맵
    if (chartType === "treemap" && treemapData) {
      return (
        <RechartsTreemapWrapper
          data={treemapData}
          seriesFields={activeSeriesFields}
          enabledSeries={enabledSeries}
          seriesColors={seriesColors}
          onTooltipChange={handleTooltipChange}
        />
      );
    }

    // 멀티레벨 트리맵
    if (chartType === "multi-level-treemap") {
      return (
        <RechartsMultiLevelTreemapWrapper
          data={data}
          seriesFields={activeSeriesFields}
          enabledSeries={enabledSeries}
          colors={MULTI_LEVEL_TREEMAP_COLORS}
          onTooltipChange={handleTooltipChange}
          onStatsChange={onTreemapStatsChange}
        />
      );
    }

    // 랭킹 막대 차트
    if (chartType === "ranking-bar") {
      return (
        <RechartsRankingBarWrapper
          data={data}
          seriesFields={activeSeriesFields}
          enabledSeries={enabledSeries}
          seriesColors={seriesColors}
          onTooltipChange={handleTooltipChange}
        />
      );
    }

    // 회귀 산점도
    if (chartType === "regression-scatter") {
      return (
        <RechartsRegressionScatterWrapper
          data={data}
          xField={regressionScatterXField || activeSeriesFields[0]}
          yField={regressionScatterYField || activeSeriesFields[1]}
          seriesColors={seriesColors}
          themeColors={themeColors}
          onTooltipChange={handleTooltipChange}
          onStatsChange={onRegressionStatsChange}
        />
      );
    }

    // 동기화 영역 차트
    if (chartType === "synced-area") {
      const handleSyncedAreaMouseMove = (chartState: any) => {
        if (chartState && chartState.activeLabel && data) {
          const hoveredData = data.find((d: any) => d.date_display === chartState.activeLabel);
          if (hoveredData) {
            const payload: any[] = [];
            if (syncedAreaLeftField) {
              const leftColorIdx = activeSeriesFields.indexOf(syncedAreaLeftField);
              payload.push({
                dataKey: syncedAreaLeftField,
                value: hoveredData[syncedAreaLeftField],
                color: seriesColors[leftColorIdx % seriesColors.length],
              });
            }
            if (syncedAreaRightField) {
              const rightColorIdx = activeSeriesFields.indexOf(syncedAreaRightField);
              payload.push({
                dataKey: syncedAreaRightField,
                value: hoveredData[syncedAreaRightField],
                color: seriesColors[rightColorIdx % seriesColors.length],
              });
            }
            handleTooltipChange(payload);
            onHoveredLabelChange?.(chartState.activeLabel);
          }
        }
      };

      const handleSyncedAreaMouseLeave = () => {
        handleTooltipChange(null);
        onHoveredLabelChange?.(null);
      };

      const gridColor = themeColors?.gridColor || "hsl(0 0% 85%)";
      const axisLineColor = getAxisLineColor();

      return (
        <div className="flex gap-4 h-full">
          {/* 좌측 차트 */}
          <div className="flex-1 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                syncId="synced-area"
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                onMouseMove={handleSyncedAreaMouseMove}
                onMouseLeave={handleSyncedAreaMouseLeave}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={0.5} />
                <XAxis
                  dataKey="date_display"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: axisLineColor, strokeWidth: 1.5 }}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: axisLineColor, strokeWidth: 1.5 }}
                  tickFormatter={(value) => {
                    if (typeof value === "number") {
                      if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                      if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}K`;
                    }
                    return value;
                  }}
                />
                <Tooltip
                  cursor={{ stroke: themeColors?.textColor || "hsl(var(--foreground))", strokeOpacity: 0.15, strokeWidth: 1, strokeDasharray: "4 4" }}
                  content={() => null}
                />
                {syncedAreaLeftField && (() => {
                  const colorIdx = activeSeriesFields.indexOf(syncedAreaLeftField);
                  const color = seriesColors[colorIdx % seriesColors.length];
                  return (
                    <Area
                      key={syncedAreaLeftField}
                      type="monotone"
                      dataKey={syncedAreaLeftField}
                      stroke={color}
                      fill={color}
                      fillOpacity={0.3}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ fill: color, stroke: color, strokeWidth: 0, r: 5 }}
                    />
                  );
                })()}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {/* 우측 차트 */}
          <div className="flex-1 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                syncId="synced-area"
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                onMouseMove={handleSyncedAreaMouseMove}
                onMouseLeave={handleSyncedAreaMouseLeave}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={0.5} />
                <XAxis
                  dataKey="date_display"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: axisLineColor, strokeWidth: 1.5 }}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: axisLineColor, strokeWidth: 1.5 }}
                  tickFormatter={(value) => {
                    if (typeof value === "number") {
                      if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                      if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}K`;
                    }
                    return value;
                  }}
                />
                <Tooltip
                  cursor={{ stroke: themeColors?.textColor || "hsl(var(--foreground))", strokeOpacity: 0.15, strokeWidth: 1, strokeDasharray: "4 4" }}
                  content={() => null}
                />
                {syncedAreaRightField && (() => {
                  const colorIdx = activeSeriesFields.indexOf(syncedAreaRightField);
                  const color = seriesColors[colorIdx % seriesColors.length];
                  return (
                    <Area
                      key={syncedAreaRightField}
                      type="monotone"
                      dataKey={syncedAreaRightField}
                      stroke={color}
                      fill={color}
                      fillOpacity={0.3}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ fill: color, stroke: color, strokeWidth: 0, r: 5 }}
                    />
                  );
                })()}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    // 기본 차트 (line, area, column, stacked 등)
    return (
      <RechartsWrapper
        data={data}
        seriesFields={activeSeriesFields}
        enabledSeries={enabledSeries}
        seriesColors={seriesColors}
        chartType={chartType}
        themeColors={themeColors}
        yFieldTypes={yFieldTypes}
        yAxisPlacements={yAxisPlacements}
        groupCount={groupCount}
        seriesGroupAssignments={seriesGroupAssignments}
        syncedAreaLeftField={syncedAreaLeftField}
        syncedAreaRightField={syncedAreaRightField}
        showMissingValues={effectiveShowMissing}
        missingValues={analysisResult?.missingValues}
        outlierScatterData={outlierScatterData}
        showOutliers={effectiveShowOutliers}
        onTooltipChange={handleTooltipChange}
        onHoveredLabelChange={handleHoveredLabelChange}
      />
    );
  };

  return (
    <div
      ref={chartContainerRef}
      className={`w-full ${className || ""}`}
      style={{ height }}
    >
      {renderChart()}
    </div>
  );
}

export default ChartWidget;
