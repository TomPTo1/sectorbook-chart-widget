"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import type {
  ChartType,
  ChartDataRow,
  YAxisPlacement,
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

  // Optional Axis Configuration
  yFieldTypes?: Record<string, "line" | "column">;
  yAxisPlacements?: Record<string, YAxisPlacement>;

  // Optional Grouping (for stacked-grouped)
  seriesGroupAssignments?: Record<string, number>;

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
    seriesUnits?: Record<string, string>;
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
  seriesFields: propSeriesFields,
  chartType,
  enabledSeries: propEnabledSeries,
  showOutliers = false,
  yFieldTypes,
  yAxisPlacements,
  seriesGroupAssignments,
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
  // 방어 처리
  const seriesFields = propSeriesFields || [];
  const enabledSeries = propEnabledSeries || new Set<string>();

  // 테마 색상 (CSS 변수에서 동적으로 가져옴)
  const [themeColors, setThemeColors] = useState(getThemeColors());

  // 차트 컨테이너 높이 측정
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartHeight, setChartHeight] = useState<number>(400);

  // 차트 컨테이너 높이 측정
  useEffect(() => {
    const updateHeight = () => {
      if (chartContainerRef.current) {
        const h = chartContainerRef.current.clientHeight;
        if (h > 0) {
          setChartHeight(h);
        }
      }
    };

    updateHeight();
    const resizeObserver = new ResizeObserver(updateHeight);
    if (chartContainerRef.current) {
      resizeObserver.observe(chartContainerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  // 테마 변경 감지
  useEffect(() => {
    const updateTheme = () => {
      setThemeColors(getThemeColors());
    };

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "class") {
          updateTheme();
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  // 좌/우측 필드 분리 (이중축 차트 전용)
  const { leftFields, rightFields } = useMemo(() => {
    if (chartType !== 'dual-axis' || !yAxisPlacements) {
      return { leftFields: seriesFields, rightFields: [] };
    }
    const left = seriesFields.filter(f => (yAxisPlacements[f] ?? 'left') === 'left');
    const right = seriesFields.filter(f => yAxisPlacements[f] === 'right');
    return { leftFields: left, rightFields: right };
  }, [chartType, seriesFields, yAxisPlacements]);

  // 좌/우축 단위 계산 (이중축 차트 전용)
  const { leftAxisUnit, rightAxisUnit } = useMemo(() => {
    if (chartType !== 'dual-axis' || !scenario?.seriesUnits) {
      return { leftAxisUnit: undefined, rightAxisUnit: undefined };
    }

    let leftUnit: string | undefined;
    for (const field of leftFields) {
      if (scenario.seriesUnits[field]) {
        leftUnit = scenario.seriesUnits[field];
        break;
      }
    }

    let rightUnit: string | undefined;
    for (const field of rightFields) {
      if (scenario.seriesUnits[field]) {
        rightUnit = scenario.seriesUnits[field];
        break;
      }
    }

    return { leftAxisUnit: leftUnit, rightAxisUnit: rightUnit };
  }, [chartType, scenario?.seriesUnits, leftFields, rightFields]);

  // 이상치 분석
  const analysisResult = useMemo(() => {
    if (!data || data.length === 0 || seriesFields.length === 0) return null;

    if (chartType === 'dual-axis' && (leftFields.length > 0 || rightFields.length > 0)) {
      const leftAnalysis = leftFields.length > 0
        ? analyzeDataQualityExtended(data, leftFields, seriesFields)
        : null;
      const rightAnalysis = rightFields.length > 0
        ? analyzeDataQualityExtended(data, rightFields, seriesFields)
        : null;

      return {
        outliers: [
          ...(leftAnalysis?.outliers || []),
          ...(rightAnalysis?.outliers || [])
        ],
        missingValues: [],
        iqrBounds: {
          ...(leftAnalysis?.iqrBounds || {}),
          ...(rightAnalysis?.iqrBounds || {})
        },
        seriesIQR: [],
        leftClassifiedData: leftAnalysis?.classifiedData || undefined,
        rightClassifiedData: rightAnalysis?.classifiedData || undefined,
        classifiedData: leftAnalysis?.classifiedData || rightAnalysis?.classifiedData || null,
        hasUpperOutliers: (leftAnalysis?.hasUpperOutliers || false) || (rightAnalysis?.hasUpperOutliers || false),
        hasLowerOutliers: (leftAnalysis?.hasLowerOutliers || false) || (rightAnalysis?.hasLowerOutliers || false),
      };
    }

    return analyzeDataQualityExtended(data, seriesFields);
  }, [data, seriesFields, chartType, leftFields, rightFields]);

  // 이상치 Scatter 데이터
  const outlierScatterData = useMemo(() => {
    if (!analysisResult) return [];
    return outliersToScatterData(analysisResult.outliers);
  }, [analysisResult]);

  // 파이 차트 데이터
  const pieChartData = useMemo(() => {
    if (chartType !== "pie" || !data || data.length === 0) return [];
    return calculateSeriesSums(data, seriesFields);
  }, [chartType, data, seriesFields]);

  // 2단계 파이 차트 데이터
  const twoLevelPieData = useMemo(() => {
    if (chartType !== "two-level-pie" || !data || data.length === 0)
      return { innerData: [], outerData: [] };
    return calculateTwoLevelPieData(data, seriesFields);
  }, [chartType, data, seriesFields]);

  // 트리맵 데이터
  const treemapData = useMemo(() => {
    if ((chartType !== "treemap" && chartType !== "multi-level-treemap") || !data || data.length === 0) return [];
    return calculateTreemapData(data, seriesFields);
  }, [chartType, data, seriesFields]);

  // 시리즈 색상
  const seriesColors = useMemo(() => {
    const baseColors = chartType === "two-level-pie"
      ? TWO_LEVEL_PIE_COLORS
      : chartType === "multi-level-treemap"
        ? MULTI_LEVEL_TREEMAP_COLORS
        : (themeColors.seriesColors.length > 0
          ? themeColors.seriesColors
          : ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"]);
    return expandSeriesColors(baseColors, seriesFields.length);
  }, [chartType, themeColors.seriesColors, seriesFields.length]);

  // 데이터 없음
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

  const supportsOutliers = !OUTLIER_UNSUPPORTED_CHARTS.includes(chartType);
  const hasOutliers = analysisResult && (analysisResult.hasUpperOutliers || analysisResult.hasLowerOutliers);

  // 콜백 핸들러
  const handleTooltipChange = (payload: any[] | null, label: string | null) => {
    onTooltipChange?.(payload);
    onHoveredLabelChange?.(label);
  };

  // 차트 렌더링
  const renderChart = () => {
    const h = chartHeight;

    // 파이 차트
    if (chartType === "pie") {
      return (
        <RechartsPieWrapper
          data={pieChartData}
          enabledSeries={enabledSeries}
          themeColors={themeColors}
          height={h}
          allSeriesFields={seriesFields}
          onTooltipChange={handleTooltipChange}
        />
      );
    }

    // 2단계 파이 차트
    if (chartType === "two-level-pie") {
      return (
        <RechartsTwoLevelPieWrapper
          innerData={twoLevelPieData.innerData}
          outerData={twoLevelPieData.outerData}
          enabledSeries={enabledSeries}
          themeColors={themeColors}
          height={h}
          allSeriesFields={seriesFields}
          onTooltipChange={handleTooltipChange}
        />
      );
    }

    // 트리맵
    if (chartType === "treemap") {
      return (
        <RechartsTreemapWrapper
          data={treemapData}
          enabledSeries={enabledSeries}
          themeColors={themeColors}
          height={h}
          allSeriesFields={seriesFields}
          onTooltipChange={handleTooltipChange}
        />
      );
    }

    // 멀티레벨 트리맵
    if (chartType === "multi-level-treemap") {
      return (
        <RechartsMultiLevelTreemapWrapper
          data={treemapData}
          enabledSeries={enabledSeries}
          themeColors={themeColors}
          height={h}
          allSeriesFields={seriesFields}
          onTooltipChange={handleTooltipChange}
          onDrilldownChange={onTreemapStatsChange}
        />
      );
    }

    // 랭킹막대
    if (chartType === "ranking-bar") {
      const lastData = data[data.length - 1];
      const rankingData = seriesFields
        .map((field) => ({
          name: field,
          value: typeof lastData?.[field] === "number" ? lastData[field] as number : 0,
        }))
        .sort((a, b) => b.value - a.value);

      return (
        <RechartsRankingBarWrapper
          data={rankingData}
          xField="name"
          yField="value"
          themeColors={themeColors}
          height={h}
          onTooltipChange={handleTooltipChange}
        />
      );
    }

    // 회귀 산점도
    if (chartType === "regression-scatter") {
      return (
        <RechartsRegressionScatterWrapper
          data={data}
          xField={regressionScatterXField || seriesFields[0]}
          yField={regressionScatterYField || seriesFields[1]}
          themeColors={themeColors}
          height={h}
          onRegressionStats={onRegressionStatsChange}
          onTooltipChange={handleTooltipChange}
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
              const leftColorIdx = seriesFields.indexOf(syncedAreaLeftField);
              payload.push({
                dataKey: syncedAreaLeftField,
                value: hoveredData[syncedAreaLeftField],
                color: seriesColors[leftColorIdx % seriesColors.length],
              });
            }
            if (syncedAreaRightField) {
              const rightColorIdx = seriesFields.indexOf(syncedAreaRightField);
              payload.push({
                dataKey: syncedAreaRightField,
                value: hoveredData[syncedAreaRightField],
                color: seriesColors[rightColorIdx % seriesColors.length],
              });
            }
            onTooltipChange?.(payload);
            onHoveredLabelChange?.(chartState.activeLabel);
          }
        }
      };
      const handleSyncedAreaMouseLeave = () => {
        onTooltipChange?.(null);
        onHoveredLabelChange?.(null);
      };

      return (
        <div className="flex gap-4" style={{ height: h }}>
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
                <CartesianGrid strokeDasharray="3 3" stroke={themeColors?.gridColor || "hsl(0 0% 85%)"} opacity={0.5} />
                <XAxis
                  dataKey="date_display"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: getAxisLineColor(), strokeWidth: 1.5 }}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: getAxisLineColor(), strokeWidth: 1.5 }}
                  tickFormatter={(value) => {
                    if (typeof value === "number") {
                      if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                      if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}K`;
                    }
                    return value;
                  }}
                />
                <Tooltip cursor={{ stroke: themeColors?.textColor || "hsl(var(--foreground))", strokeOpacity: 0.15, strokeWidth: 1, strokeDasharray: "4 4" }} content={() => null} />
                {syncedAreaLeftField && (() => {
                  const colorIdx = seriesFields.indexOf(syncedAreaLeftField);
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
                <CartesianGrid strokeDasharray="3 3" stroke={themeColors?.gridColor || "hsl(0 0% 85%)"} opacity={0.5} />
                <XAxis
                  dataKey="date_display"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: getAxisLineColor(), strokeWidth: 1.5 }}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: getAxisLineColor(), strokeWidth: 1.5 }}
                  tickFormatter={(value) => {
                    if (typeof value === "number") {
                      if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                      if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}K`;
                    }
                    return value;
                  }}
                />
                <Tooltip cursor={{ stroke: themeColors?.textColor || "hsl(var(--foreground))", strokeOpacity: 0.15, strokeWidth: 1, strokeDasharray: "4 4" }} content={() => null} />
                {syncedAreaRightField && (() => {
                  const colorIdx = seriesFields.indexOf(syncedAreaRightField);
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

    // 이상치 활성화 + 이상치 존재 시: 분할 차트
    if (showOutliers && supportsOutliers && hasOutliers && analysisResult?.classifiedData) {
      return (
        <RechartsSplitWrapper
          xField="date_display"
          yFields={Array.from(enabledSeries)}
          allSeriesFields={seriesFields}
          chartType={chartType}
          yFieldTypes={chartType === 'mixed' || chartType === 'dual-axis' ? yFieldTypes : undefined}
          yAxisPlacements={chartType === 'dual-axis' ? yAxisPlacements : undefined}
          themeColors={themeColors}
          totalHeight={h}
          classifiedData={analysisResult.classifiedData}
          leftClassifiedData={chartType === 'dual-axis' ? analysisResult.leftClassifiedData : undefined}
          rightClassifiedData={chartType === 'dual-axis' ? analysisResult.rightClassifiedData : undefined}
          outliers={analysisResult.outliers}
          fullData={data as any}
          onTooltipChange={handleTooltipChange}
          axisUnit={scenario?.unit}
          leftAxisUnit={leftAxisUnit}
          rightAxisUnit={rightAxisUnit}
        />
      );
    }

    // 일반 차트
    return (
      <RechartsWrapper
        data={data as any}
        xField="date_display"
        yFields={Array.from(enabledSeries)}
        allSeriesFields={seriesFields}
        chartType={chartType}
        yFieldTypes={chartType === 'mixed' || chartType === 'dual-axis' ? yFieldTypes : undefined}
        yAxisPlacements={chartType === 'dual-axis' ? yAxisPlacements : undefined}
        seriesGroupAssignments={chartType === 'stacked-grouped' ? seriesGroupAssignments : undefined}
        themeColors={themeColors}
        height={h}
        outlierData={showOutliers && supportsOutliers ? outlierScatterData : []}
        showOutliers={showOutliers && supportsOutliers}
        onTooltipChange={handleTooltipChange}
        axisUnit={chartType !== 'dual-axis' ? scenario?.unit : undefined}
        leftAxisUnit={chartType === 'dual-axis' ? leftAxisUnit : undefined}
        rightAxisUnit={chartType === 'dual-axis' ? rightAxisUnit : undefined}
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
