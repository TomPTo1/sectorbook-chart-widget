"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Scatter,
  ReferenceLine,
} from "recharts";
import type { ChartType, ChartDataItem, OutlierInfo, YAxisPlacement } from "../../types/chart-config";
import type { ChartThemeColors } from "./recharts-wrapper";
import { CustomYAxisLine } from "./custom-y-axis-line";
import { formatDateForXAxis } from "../utils/recharts-adapter";
import { getZeroLineStyle } from "./recharts-utils";

export type RegionType = "upper" | "normal" | "lower";

/**
 * 값의 크기(magnitude)에 따라 동적으로 라운딩
 */
function roundToNice(value: number, isMax: boolean): number {
  if (value === 0) return 0;

  const absValue = Math.abs(value);
  const magnitude = Math.pow(10, Math.floor(Math.log10(absValue)));

  if (isMax) {
    return value >= 0
      ? Math.ceil(value / magnitude) * magnitude
      : Math.floor(value / magnitude) * magnitude;
  } else {
    return value >= 0
      ? Math.floor(value / magnitude) * magnitude
      : Math.floor(value / magnitude) * magnitude;
  }
}

export interface RechartsRegionChartProps {
  data: ChartDataItem[];
  fullData?: ChartDataItem[];  // X축 동기화용 전체 데이터
  xField: string;
  yFields: string[];
  allSeriesFields?: string[];
  chartType: ChartType;
  themeColors?: ChartThemeColors;
  height: number;
  yFieldTypes?: Record<string, "column" | "line">;
  yAxisPlacements?: Record<string, YAxisPlacement>;
  domain?: [number, number];  // 일반 차트용
  leftDomain?: [number, number];  // 추가: 이중축 좌측
  rightDomain?: [number, number];  // 추가: 이중축 우측
  regionType: RegionType;
  hasBreakTop: boolean;
  hasBreakBottom: boolean;
  showXAxis: boolean;
  outliers?: OutlierInfo[];
  onTooltipChange?: (payload: any[] | null, label: string | null) => void;
  hoveredLabel?: string | null;  // Wrapper에서 전달받는 통합 호버 상태
  datetimeUnit?: number;
  chartWidth?: number;
  axisUnit?: string;      // Y축 단위 (단일축용)
  leftAxisUnit?: string;  // 좌측 Y축 단위 (이중축용)
  rightAxisUnit?: string; // 우측 Y축 단위 (이중축용)
}

export function RechartsRegionChart({
  data,
  fullData,
  xField,
  yFields,
  allSeriesFields,
  chartType,
  themeColors,
  height,
  yFieldTypes,
  yAxisPlacements,
  domain,
  leftDomain: leftDomainProp,
  rightDomain: rightDomainProp,
  regionType,
  hasBreakTop,
  hasBreakBottom,
  showXAxis,
  outliers = [],
  onTooltipChange,
  hoveredLabel,
  datetimeUnit = 1,
  chartWidth = 0,
  axisUnit,
  leftAxisUnit,
  rightAxisUnit,
}: RechartsRegionChartProps) {
  // 로컬 호버 상태 추적
  const [localHoveredLabel, setLocalHoveredLabel] = useState<string | null>(null);

  // Wrapper 상태와 병합 (Wrapper 우선)
  const effectiveHoveredLabel = hoveredLabel ?? localHoveredLabel;

  // X축 동기화: fullData가 있으면 전체 데이터 사용
  const baseData = fullData || data;

  // 차트 타입 감지
  const isBarChart = chartType === 'column' || chartType === 'stacked' ||
    (chartType === 'mixed' && yFields.some(f => !yFieldTypes || yFieldTypes[f] === 'column'));

  // 이중축일 때 좌/우측 필드 분리
  const { leftFields, rightFields } = useMemo(() => {
    if (chartType !== 'dual-axis' || !yAxisPlacements) {
      return { leftFields: yFields, rightFields: [] };
    }

    // yAxisPlacements에 없는 필드는 기본값 'left'로 처리
    const left = yFields.filter(f => (yAxisPlacements[f] ?? 'left') === 'left');
    const right = yFields.filter(f => yAxisPlacements[f] === 'right');

    return { leftFields: left, rightFields: right };
  }, [chartType, yFields, yAxisPlacements]);

  // 이중축일 때 좌측 Y축 domain 계산 (현재 영역의 data 기준)
  const leftDomain = useMemo(() => {
    if (chartType !== 'dual-axis') {
      return undefined;
    }

    // 분할 차트(regionType 존재)에서는 전달받은 leftDomainProp 우선 사용
    if (regionType && leftDomainProp && Array.isArray(leftDomainProp) && leftDomainProp.length === 2) {
      const [min, max] = leftDomainProp;
      if (typeof min === 'number' && typeof max === 'number' && !isNaN(min) && !isNaN(max)) {
        return leftDomainProp;
      }
    }

    // leftFields가 비어있어도 기본 domain 제공 (YAxis가 항상 존재하므로)
    if (leftFields.length === 0) {
      return [0, 1] as [number, number];
    }

    // 일반 이중축 차트: 기존 로직 유지 (data 기반 계산)
    if (data.length === 0) return undefined;

    let min = Infinity, max = -Infinity;
    let hasValue = false;

    for (const row of data) {
      for (const field of leftFields) {
        const value = row[field];
        if (typeof value === 'number' && !isNaN(value)) {
          min = Math.min(min, value);
          max = Math.max(max, value);
          hasValue = true;
        }
      }
    }

    if (!hasValue) return undefined;

    // 0을 포함하도록 조정
    min = Math.min(0, min);
    max = Math.max(0, max);

    min = roundToNice(min, false);
    max = roundToNice(max, true);

    return [min, max] as [number, number];
  }, [chartType, leftFields, data, regionType, leftDomainProp]);

  // 이중축일 때 우측 Y축 domain 계산 (현재 영역의 data 기준)
  const rightDomain = useMemo(() => {
    if (chartType !== 'dual-axis') {
      return undefined;
    }

    // rightFields가 비어있어도 기본 domain 제공 (YAxis가 항상 존재하므로)
    if (rightFields.length === 0) {
      return [0, 1] as [number, number];
    }

    // 분할 차트(regionType 존재)에서는 전달받은 rightDomainProp 우선 사용
    if (regionType && rightDomainProp && Array.isArray(rightDomainProp) && rightDomainProp.length === 2) {
      const [min, max] = rightDomainProp;
      if (typeof min === 'number' && typeof max === 'number' && !isNaN(min) && !isNaN(max)) {
        return rightDomainProp;
      }
    }

    // 일반 이중축 차트: 기존 로직 유지 (data 기반 계산)
    if (data.length === 0) return undefined;

    let min = Infinity, max = -Infinity;
    let hasValue = false;

    for (const row of data) {
      for (const field of rightFields) {
        const value = row[field];
        if (typeof value === 'number' && !isNaN(value)) {
          min = Math.min(min, value);
          max = Math.max(max, value);
          hasValue = true;
        }
      }
    }

    if (!hasValue) return undefined;

    // 0을 포함하도록 조정
    min = Math.min(0, min);
    max = Math.max(0, max);

    min = roundToNice(min, false);
    max = roundToNice(max, true);

    return [min, max] as [number, number];
  }, [chartType, rightFields, data, regionType, rightDomainProp]);

  // 누적막대에서 양수/음수 혼합 시리즈를 분리하는 함수 (baseData 기반)
  const getMixedSeriesStats = useMemo(() => {
    if (chartType !== "stacked") return { fields: yFields, fieldStats: [] };

    // 각 필드의 양수/음수 여부 확인
    const fieldStats = yFields.map(field => {
      const values = baseData
        .map(item => item[field])
        .filter((v): v is number => typeof v === "number" && !isNaN(v));

      const hasNegative = values.some(v => v < 0);
      const hasPositive = values.some(v => v > 0);

      return {
        field,
        hasNegative,
        hasPositive,
        isMixed: hasNegative && hasPositive
      };
    });

    // 혼합 시리즈가 없으면 원본 필드 반환
    if (!fieldStats.some(s => s.isMixed)) {
      return { fields: yFields, fieldStats };
    }

    // 새로운 필드 목록 생성
    const newFields: string[] = [];
    fieldStats.forEach(({ field, isMixed }) => {
      if (isMixed) {
        newFields.push(`${field}_positive`, `${field}_negative`);
      } else {
        newFields.push(field);
      }
    });

    return { fields: newFields, fieldStats };
  }, [baseData, yFields, chartType]);

  // X축 레이블 필터링 로직
  const LABEL_MIN_WIDTH = 60;
  const xLabels = baseData.map((d) => d[xField] as string);

  const calculateVisibleLabels = useMemo(() => {
    if (!chartWidth || chartWidth === 0) {
      return { maxLabels: 10, shouldShowAll: xLabels.length <= 10 };
    }
    const maxPossibleLabels = Math.floor(chartWidth / LABEL_MIN_WIDTH);
    const canShowAll = xLabels.length <= maxPossibleLabels;
    return {
      maxLabels: Math.max(5, maxPossibleLabels),
      shouldShowAll: canShowAll,
    };
  }, [chartWidth, xLabels.length]);

  const { maxLabels, shouldShowAll } = calculateVisibleLabels;

  const visibleTicks = useMemo(() => {
    const ticks: string[] = [];

    xLabels.forEach((label, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === xLabels.length - 1;

      // 막대그래프: 첫/마지막 조건부 표시
      if (isBarChart) {
        // 첫 번째는 항상 추가
        if (isFirst) {
          ticks.push(label);
          return;
        }

        // 마지막은 datetime_unit 조건 확인
        if (isLast) {
          if (!datetimeUnit || datetimeUnit === 1) {
            ticks.push(label);
          } else if (idx % datetimeUnit === 0) {
            ticks.push(label);
          }
          return;
        }
      } else {
        // 라인/영역: 첫/마지막 스킵 유지
        if (isFirst || isLast) return;
      }

      // 중간 값들: 기존 로직 그대로
      // datetime_unit 우선 적용
      if (datetimeUnit && datetimeUnit > 1) {
        if (idx % datetimeUnit === 0) {
          ticks.push(label);
        }
        return;
      }

      if (shouldShowAll) {
        ticks.push(label);
        return;
      }

      const step = Math.ceil(xLabels.length / maxLabels);
      if (idx % step === 0) {
        ticks.push(label);
      }
    });

    return ticks;
  }, [xLabels, shouldShowAll, maxLabels, datetimeUnit, isBarChart]);

  // 이상치를 날짜별로 그룹화 (활성화된 시리즈만)
  const outliersByDate = new Map<string, OutlierInfo[]>();
  outliers
    .filter((o) => o.bound === (regionType === 'upper' ? 'upper' : 'lower'))
    .filter((o) => yFields.includes(o.field))
    .forEach((o) => {
      if (!outliersByDate.has(o.date_display)) {
        outliersByDate.set(o.date_display, []);
      }
      outliersByDate.get(o.date_display)!.push(o);
    });

  // chartData 생성: 영역별로 다른 로직 적용
  const chartData = baseData.map((item) => {
    // 실제 데이터에서 해당 날짜의 값 찾기 (이상치가 null로 마스킹됨)
    const actualDataItem = data.find((d) => d.date_display === item.date_display);

    // 해당 날짜의 이상치들 가져오기
    const dateOutliers = outliersByDate.get(item.date_display) || [];

    let row: any;

    if (regionType === 'upper' || regionType === 'lower') {
      // Upper/Lower 영역: 이상치만 포함 (라인/막대 데이터 제외)
      const outlierFields = dateOutliers.reduce((acc, outlier, idx) => {
        acc[`outlier_${idx}`] = outlier.value;
        acc[`outlier_${idx}_field`] = outlier.field;
        return acc;
      }, {} as Record<string, number | string>);

      row = {
        date: item.date,
        date_display: item.date_display,
        ...outlierFields,
      };
    } else {
      // Normal 영역: 실제 data의 값 사용 (이상치가 null로 마스킹됨)
      row = {
        date: item.date,
        date_display: item.date_display,
        ...(actualDataItem || {}),
      };
    }

    // 누적막대에서 혼합 시리즈 분리
    if (chartType === "stacked") {
      getMixedSeriesStats.fieldStats.forEach(({ field, isMixed }) => {
        if (isMixed) {
          const value = row[field];
          if (typeof value === "number") {
            row[`${field}_positive`] = value >= 0 ? value : null;
            row[`${field}_negative`] = value < 0 ? value : null;
          }
        }
      });
    }

    return row;
  });

  const colors = themeColors?.seriesColors || [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
    "hsl(var(--chart-6))",
    "hsl(var(--chart-7))",
    "hsl(var(--chart-8))",
  ];

  const renderSeries = (fieldsToRender?: string[]) => {
    // 파라미터로 받은 필드가 있으면 그것을 사용, 아니면 getMixedSeriesStats 사용
    const { fields: renderFields, fieldStats } = fieldsToRender
      ? { fields: fieldsToRender, fieldStats: [] as any[] }
      : getMixedSeriesStats;

    // Bar와 Line 시리즈를 분리하여 Bar가 먼저, Line이 나중에 렌더링되도록 함
    // (recharts에서 나중에 렌더링된 요소가 위에 표시됨)
    const barSeries: React.ReactElement[] = [];
    const lineSeries: React.ReactElement[] = [];

    // 누적막대에서 마지막 Bar 시리즈 인덱스 계산
    const barFields = renderFields.filter((field) => {
      const originalField = field.replace(/_positive$|_negative$/, '');
      if (chartType === "line") return false;
      if (chartType === "mixed" || chartType === "dual-axis") {
        return (yFieldTypes?.[originalField] ?? "column") === "column";
      }
      return true;
    });
    const lastBarFieldIndex = barFields.length - 1;
    let currentBarIndex = 0;

    renderFields.forEach((field) => {
      // 원본 필드명 추출
      const originalField = field.replace(/_positive$|_negative$/, '');
      const isPositiveSplit = field.endsWith('_positive');
      const isNegativeSplit = field.endsWith('_negative');

      // 색상 결정 (분리된 필드는 원본 필드의 색상 사용)
      const colorField = isPositiveSplit || isNegativeSplit ? originalField : field;
      // 원본 seriesFields에서 인덱스 찾기 (필터링 전 원래 위치)
      const originalSeriesFields = allSeriesFields || yFields;
      const originalIndex = originalSeriesFields.indexOf(colorField);
      const color = originalIndex >= 0
        ? (themeColors?.seriesColors?.[originalIndex % (themeColors?.seriesColors?.length || 8)] || colors[0])
        : colors[0];

      // 차트 타입별 시리즈 타입 결정
      let seriesType: "column" | "line";
      if (chartType === "line") {
        seriesType = "line";
      } else if (chartType === "mixed" || chartType === "dual-axis") {
        // 혼합 차트 or 이중축: yFieldTypes에서 지정한 타입 사용, 기본값은 "column"
        seriesType = yFieldTypes?.[originalField] ?? "column";
      } else {
        // column, stacked 등: 막대
        seriesType = "column";
      }

      // 이중축일 때 yAxisId 지정 (recharts-wrapper 패턴)
      const yAxisId = chartType === 'dual-axis' && yAxisPlacements
        ? (yAxisPlacements[originalField] || 'left')
        : 'default';

      if (seriesType === "line") {
        lineSeries.push(
          <Line
            key={field}
            type="monotone"
            dataKey={field}
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={(props: any) => {
              // 값이 null/undefined면 마커를 렌더링하지 않음 (이상치로 마스킹된 경우)
              if (props.payload?.[field] == null) {
                return <></>;
              }

              const isHovered = effectiveHoveredLabel === props.payload?.[xField];
              if (!isHovered) return <></>;

              return (
                <circle
                  cx={props.cx}
                  cy={props.cy}
                  r={5}
                  fill={color}
                  stroke={color}
                  strokeWidth={0}
                />
              );
            }}
            connectNulls={false}
            {...(yAxisId && { yAxisId })}
          />
        );
      } else {
        // 라운딩 처리 로직
        const isLastBar = currentBarIndex === lastBarFieldIndex;
        let barRadius: number | [number, number, number, number];

        if (chartType === "stacked") {
          // 누적 막대: 마지막 시리즈만 위쪽 라운딩
          barRadius = isLastBar ? [2, 2, 0, 0] : 0;
        } else {
          // 일반 막대: 모든 막대 위쪽만 라운딩
          barRadius = [2, 2, 0, 0];
        }

        barSeries.push(
          <Bar
            key={field}
            dataKey={field}
            fill={color}
            radius={barRadius}
            stackId={chartType === "stacked" ? "stack" : undefined}
            {...(yAxisId && { yAxisId })}
          />
        );
        currentBarIndex++;
      }
    });

    // Bar 먼저, Line 나중에 렌더링 (Line이 막대 위에 표시됨)
    return [...barSeries, ...lineSeries];
  };

  return (
    <div className="relative" style={{ height, overflow: "visible" }}>
      {/* 커스텀 Y축 선 (zigzag 포함) */}
      {chartType === 'dual-axis' && (regionType !== 'normal' || hasBreakTop || hasBreakBottom) ? (
        <>
          {/* 이중축: 좌측 Y축 물결선 */}
          <div className="absolute" style={{ left: 56, top: 0, height: height, zIndex: 5, pointerEvents: 'none' }}>
            <CustomYAxisLine
              height={height}
              hasBreakTop={hasBreakTop}
              hasBreakBottom={hasBreakBottom}
            />
          </div>
          {/* 이중축: 우측 Y축 물결선 */}
          {rightFields.length > 0 && (
            <div className="absolute" style={{ right: 64, top: 0, height: height, zIndex: 5, pointerEvents: 'none' }}>
              <CustomYAxisLine
                height={height}
                hasBreakTop={hasBreakTop}
                hasBreakBottom={hasBreakBottom}
              />
            </div>
          )}
        </>
      ) : chartType !== 'dual-axis' && (hasBreakTop || hasBreakBottom) ? (
        // 기존 물결선 (좌측)
        <div className="absolute" style={{ left: 56, top: 0, height: height }}>
          <CustomYAxisLine
            height={height}
            hasBreakTop={hasBreakTop}
            hasBreakBottom={hasBreakBottom}
          />
        </div>
      ) : null}

      {/* 단일축 Y축 단위 라벨 (normal 영역만) */}
      {chartType !== 'dual-axis' && regionType === 'normal' && axisUnit && (
        <svg style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 60,
          height: height,
          pointerEvents: 'none',
          zIndex: 10
        }}>
          <text
            x={55}
            y={28}
            textAnchor="end"
            fill="hsl(var(--muted-foreground))"
            fontSize={10}
          >
            ({axisUnit})
          </text>
        </svg>
      )}

      {/* Y축 레이블 (수동) - fullData 기반 전체 범위 사용 */}
      {chartType === 'dual-axis' && leftDomain && (
        <svg style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 60,
          height: height,
          pointerEvents: 'none',
          zIndex: 10
        }}>
          {[
            { value: leftDomain[0], yPos: height - 15 },
            { value: (leftDomain[0] + leftDomain[1]) / 2, yPos: height / 2 },
            { value: leftDomain[1], yPos: 15 }
          ].map((item, idx) => {
            let display = item.value.toFixed(0);
            if (Math.abs(item.value) >= 1000000) display = `${(item.value / 1000000).toFixed(1)}M`;
            else if (Math.abs(item.value) >= 1000) display = `${(item.value / 1000).toFixed(1)}K`;

            return (
              <text
                key={idx}
                x={55}
                y={item.yPos}
                dy={4}
                textAnchor="end"
                fill="hsl(var(--muted-foreground))"
                fontSize={11}
              >
                {display}
              </text>
            );
          })}
          {/* 좌측 Y축 단위 라벨 (normal 영역만) */}
          {regionType === 'normal' && leftAxisUnit && (
            <text
              x={55}
              y={34}
              textAnchor="end"
              fill="hsl(var(--muted-foreground))"
              fontSize={10}
            >
              ({leftAxisUnit})
            </text>
          )}
        </svg>
      )}

      {/* 이중축 이상치 영역 레이블 - upper/lower 영역일 때만 표시 */}
      {chartType === 'dual-axis' && (regionType === 'upper' || regionType === 'lower') && (
        <svg style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 60,
          height: height,
          pointerEvents: 'none',
          zIndex: 10
        }}>
          <text
            x={15}
            y={height / 2}
            textAnchor="middle"
            fill="hsl(var(--muted-foreground))"
            fontSize={11}
            transform={`rotate(-90, 15, ${height / 2})`}
          >
            이상치 영역
          </text>
        </svg>
      )}

      {chartType === 'dual-axis' && rightDomain && rightFields.length > 0 && (
        <svg style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: 60,
          height: height,
          pointerEvents: 'none',
          zIndex: 10
        }}>
          {[
            { value: rightDomain[0], yPos: height - 15 },
            { value: (rightDomain[0] + rightDomain[1]) / 2, yPos: height / 2 },
            { value: rightDomain[1], yPos: 15 }
          ].map((item, idx) => {
            let display = item.value.toFixed(0);
            if (Math.abs(item.value) >= 1000000) display = `${(item.value / 1000000).toFixed(1)}M`;
            else if (Math.abs(item.value) >= 1000) display = `${(item.value / 1000).toFixed(1)}K`;

            return (
              <text
                key={idx}
                x={5}
                y={item.yPos}
                dy={4}
                textAnchor="start"
                fill="hsl(var(--muted-foreground))"
                fontSize={11}
              >
                {display}
              </text>
            );
          })}
          {/* 우측 Y축 단위 라벨 (normal 영역만) */}
          {regionType === 'normal' && rightAxisUnit && (
            <text
              x={5}
              y={34}
              textAnchor="start"
              fill="hsl(var(--muted-foreground))"
              fontSize={10}
            >
              ({rightAxisUnit})
            </text>
          )}
        </svg>
      )}

      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{
            top: hasBreakTop ? 2 : 5,
            right: chartType === 'dual-axis' ? 60 : 30,
            left: chartType === 'dual-axis' ? 60 : 0,
            bottom: showXAxis ? (chartData.length > 10 ? 100 : 50) : 2,
          }}
          onMouseMove={(state: any) => {
            if (state && state.activeLabel) {
              const label = state.activeLabel;
              const payload = state.activePayload || [];
              setLocalHoveredLabel(label);
              onTooltipChange?.(payload, label);
            }
          }}
          onMouseLeave={() => {
            setLocalHoveredLabel(null);
            onTooltipChange?.(null, null);
          }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={themeColors?.gridColor || "hsl(0 0% 85%)"}
            opacity={0.5}
          />

          {showXAxis && (
            <XAxis
              dataKey={xField}
              type="category"
              padding={{ left: 0, right: 0 }}
              ticks={visibleTicks}
              minTickGap={5}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--muted-foreground))" }}
              angle={chartData.length > 10 ? -45 : 0}
              textAnchor={chartData.length > 10 ? "end" : "middle"}
              height={chartData.length > 10 ? 80 : 40}
              tickFormatter={(value) => formatDateForXAxis(value)}
            />
          )}

          {!showXAxis && (
            <XAxis
              dataKey={xField}
              type="category"
              tick={false}
              axisLine={false}
              tickLine={false}
              height={0}
            />
          )}

          {/* 좌측 Y축 - 항상 렌더링 (recharts-wrapper 패턴) */}
          <YAxis
            yAxisId="left"
            orientation="left"
            width={0}
            domain={chartType === 'dual-axis' ? leftDomain : undefined}
            tick={false}
            tickLine={false}
            axisLine={false}
          />

          {/* 우측 Y축 - 항상 렌더링 (recharts-wrapper 패턴) */}
          <YAxis
            yAxisId="right"
            orientation="right"
            width={0}
            domain={chartType === 'dual-axis' ? rightDomain : undefined}
            tick={false}
            tickLine={false}
            axisLine={false}
          />

          {/* 기본 Y축 - 항상 렌더링 */}
          <YAxis
            yAxisId="default"
            domain={chartType === 'dual-axis' ? undefined : domain}
            ticks={
              chartType !== 'dual-axis' && (regionType === 'upper' || regionType === 'lower') && domain
                ? [domain[0], domain[1]]
                : undefined
            }
            interval={
              chartType !== 'dual-axis' && (regionType === 'upper' || regionType === 'lower')
                ? 0
                : undefined
            }
            allowDataOverflow={false}
            tick={chartType === 'dual-axis' ? false : { fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => {
              if (typeof value === "number") {
                if (Math.abs(value) >= 1000000) {
                  return `${(value / 1000000).toFixed(1)}M`;
                }
                if (Math.abs(value) >= 1000) {
                  return `${(value / 1000).toFixed(1)}K`;
                }
                return value.toFixed(0);
              }
              return value;
            }}
            width={chartType === 'dual-axis' ? 0 : 60}
            label={
              chartType !== 'dual-axis' && (regionType === 'upper' || regionType === 'lower')
                ? {
                    value: '이상치 영역',
                    angle: -90,
                    position: 'center',
                    dx: -10,
                    style: {
                      fill: 'hsl(var(--muted-foreground))',
                      fontSize: 11,
                    }
                  }
                : undefined
            }
          />

          {(() => {
            // 이중축일 때: 좌측 도메인이 0을 포함하는지 확인
            if (chartType === 'dual-axis') {
              const leftIncludesZero = leftDomain && leftDomain[0] <= 0 && leftDomain[1] >= 0;

              // 좌측이 0을 포함하지 않으면 보조선 없음
              if (!leftIncludesZero) {
                return null;
              }

              // 좌측 기준 실선 보조선
              return (
                <ReferenceLine
                  y={0}
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={1}
                  yAxisId="left"
                />
              );
            }

            // 일반 차트: 기존 로직
            const getAxisColor = () => {
              const isDark = document.documentElement.classList.contains('dark');
              return isDark ? "#ffffff" : "hsl(0 0% 44%)";
            };

            const zeroLineStyle = getZeroLineStyle(data, yFields);

            if (!zeroLineStyle.useSolid) {
              return (
                <ReferenceLine
                  y={0}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                  opacity={0.5}
                  yAxisId="default"
                />
              );
            }

            if (zeroLineStyle.useAxisStyle) {
              return (
                <ReferenceLine
                  y={0}
                  stroke={getAxisColor()}
                  strokeWidth={1.5}
                  yAxisId="default"
                />
              );
            }

            return (
              <ReferenceLine
                y={0}
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={1}
                opacity={0.5}
                yAxisId="default"
              />
            );
          })()}

          <Tooltip
            cursor={false}
            content={() => null}
          />

          {/* Normal 영역: 모든 시리즈 표시 */}
          {regionType === "normal" && renderSeries()}

          {/* Upper/Lower 영역에서는 빨간 Scatter만 표시 */}
          {(regionType === "upper" || regionType === "lower") && (() => {
            // 최대 이상치 개수 찾기
            const maxOutliers = Math.max(
              0,
              ...chartData.map((d: any) => {
                const outlierKeys = Object.keys(d).filter(k => k.startsWith('outlier_') && !k.endsWith('_field'));
                return outlierKeys.length;
              })
            );

            if (maxOutliers === 0) return null;

            // 이중축일 때 Line 컴포넌트로 이상치 표시 (Scatter 대신 Line 사용하여 X 좌표 정렬)
            if (chartType === 'dual-axis') {
              return Array.from({ length: maxOutliers }, (_, idx) => {
                // 이상치의 필드에 따라 적절한 Y축 사용
                const outlierField = chartData.find((d: any) => d[`outlier_${idx}`] !== undefined)?.[`outlier_${idx}_field`];
                const fieldPlacement = outlierField ? (yAxisPlacements?.[outlierField] ?? 'left') : 'left';
                const yAxisId = fieldPlacement === 'right' ? 'right' : 'left';

                return (
                  <Line
                    key={`outlier-${idx}`}
                    type="monotone"
                    dataKey={`outlier_${idx}`}
                    stroke="transparent"
                    strokeWidth={0}
                    dot={(props: any) => {
                      if (props.payload?.[`outlier_${idx}`] === undefined) return <g key={`empty-${props.index}`} />;
                      const isHovered = effectiveHoveredLabel === props.payload?.[xField];
                      const radius = isHovered ? 4 : 3;
                      return (
                        <circle
                          key={props.index}
                          cx={props.cx}
                          cy={props.cy}
                          r={radius}
                          fill="#ef4444"
                          style={{ cursor: "pointer" }}
                        />
                      );
                    }}
                    activeDot={false}
                    yAxisId={yAxisId}
                    isAnimationActive={false}
                    connectNulls={false}
                  />
                );
              });
            }

            // 일반 차트: 기존 로직
            return Array.from({ length: maxOutliers }, (_, idx) => (
              <Scatter
                key={`outlier-${idx}`}
                name={`이상치`}
                dataKey={`outlier_${idx}`}
                fill="#ef4444"
                yAxisId="default"
                isAnimationActive={false}
                shape={(props: unknown) => {
                  const p = props as { cx?: number; cy?: number; payload?: any };
                  if (p.cx === undefined || p.cy === undefined) return <></>;
                  if (!p.payload || p.payload[`outlier_${idx}`] === undefined) return <></>;

                  // 이상치가 속한 필드 찾기
                  const outlierField = p.payload[`outlier_${idx}_field`];
                  if (!outlierField) return <></>;

                  // 해당 필드가 활성화된 시리즈 중 몇 번째인지 찾기
                  const fieldIndex = yFields.indexOf(outlierField);
                  if (fieldIndex === -1) return <></>;

                  // Bar 차트 타입일 때만 X offset 조정
                  let adjustedCx = p.cx;

                  if (chartType === 'column' || (chartType === 'mixed' && yFieldTypes?.[outlierField] === 'column')) {
                    if (chartWidth > 0) {
                      const barCategoryGap = 0.1;
                      const barGap = 4;
                      const categoryCount = baseData.length;
                      const totalCategoryGapWidth = chartWidth * barCategoryGap;
                      const availableWidthPerCategory = (chartWidth - totalCategoryGapWidth) / categoryCount;
                      const activeBarCount = yFields.length;
                      const barWidth = activeBarCount > 1
                        ? (availableWidthPerCategory - barGap * (activeBarCount - 1)) / activeBarCount
                        : availableWidthPerCategory;
                      const barOffset = fieldIndex * (barWidth + barGap);
                      const centerOffset = barOffset + barWidth / 2;
                      adjustedCx = p.cx - (availableWidthPerCategory / 2) + centerOffset;
                    }
                  }

                  // 호버 상태 확인
                  const isHovered = effectiveHoveredLabel === p.payload[xField];
                  const radius = isHovered ? 4 : 3;

                  return (
                    <circle
                      cx={adjustedCx}
                      cy={p.cy}
                      r={radius}
                      fill="#ef4444"
                      style={{ cursor: "pointer" }}
                    />
                  );
                }}
              />
            ));
          })()}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
