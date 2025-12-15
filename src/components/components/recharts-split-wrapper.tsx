"use client";

import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import type { ChartType, RegionClassifiedData, OutlierInfo, ChartDataItem, YAxisPlacement } from "../../types/chart-config";
import type { ChartThemeColors } from "./recharts-wrapper";
import { RechartsRegionChart } from "./recharts-region-chart";
import { calculateRegionHeights, formatDateForXAxis } from "../utils/recharts-adapter";

export interface RechartsSplitWrapperProps {
  xField: string;
  yFields: string[];
  allSeriesFields?: string[];
  chartType: ChartType;
  themeColors?: ChartThemeColors;
  totalHeight?: number;
  yFieldTypes?: Record<string, "column" | "line">;
  yAxisPlacements?: Record<string, YAxisPlacement>;
  classifiedData: RegionClassifiedData | null;  // 일반 차트용
  leftClassifiedData?: RegionClassifiedData;  // 추가: 이중축 좌측
  rightClassifiedData?: RegionClassifiedData;  // 추가: 이중축 우측
  outliers: OutlierInfo[];
  fullData: ChartDataItem[];  // X축 동기화용 전체 데이터
  onTooltipChange?: (payload: any[] | null, label: string | null) => void;
  datetimeUnit?: number;
  axisUnit?: string;        // Y축 단위 (단일축용)
  leftAxisUnit?: string;    // 좌측 Y축 단위 (이중축용)
  rightAxisUnit?: string;   // 우측 Y축 단위 (이중축용)
}

/**
 * 분할 차트 래퍼 컴포넌트
 * Upper/Normal/Lower 영역을 하나의 연결된 차트처럼 표시
 */
export function RechartsSplitWrapper({
  xField,
  yFields,
  allSeriesFields,
  chartType,
  themeColors,
  totalHeight = 400,
  yFieldTypes,
  yAxisPlacements,
  classifiedData,
  leftClassifiedData,
  rightClassifiedData,
  outliers,
  fullData,
  onTooltipChange,
  datetimeUnit = 1,
  axisUnit,
  leftAxisUnit,
  rightAxisUnit,
}: RechartsSplitWrapperProps) {
  // 이중축일 때 좌/우측 데이터 사용, 아니면 기존 classifiedData
  const isDualAxis = chartType === 'dual-axis';
  const effectiveLeftData = isDualAxis && leftClassifiedData ? leftClassifiedData : classifiedData;
  const effectiveRightData = isDualAxis && rightClassifiedData ? rightClassifiedData : undefined;

  // effectiveLeftData가 null이면 렌더링하지 않음
  if (!effectiveLeftData) {
    return null;
  }

  // 이중축일 때 좌/우측 데이터 병합 (날짜별로)
  const mergeRegionData = useCallback((
    leftRegion: { data: ChartDataItem[]; domain: [number, number]; hasData?: boolean },
    rightRegion: { data: ChartDataItem[]; domain: [number, number]; hasData?: boolean } | undefined
  ): { data: ChartDataItem[]; domain: [number, number]; hasData: boolean } => {
    if (!isDualAxis || !rightRegion) {
      return {
        data: leftRegion.data,
        domain: leftRegion.domain,
        hasData: leftRegion.hasData ?? false,
      };
    }

    // 좌측과 우측 데이터 병합
    const mergedData = [...leftRegion.data];
    for (const rightItem of rightRegion.data) {
      const existingIdx = mergedData.findIndex(d => d.date_display === rightItem.date_display);
      if (existingIdx >= 0) {
        // 기존 항목에 우측 필드 값 추가
        mergedData[existingIdx] = { ...mergedData[existingIdx], ...rightItem };
      } else {
        mergedData.push(rightItem);
      }
    }

    return {
      data: mergedData,
      domain: leftRegion.domain,
      hasData: (leftRegion.hasData ?? false) || (rightRegion.hasData ?? false),
    };
  }, [isDualAxis]);

  // 병합된 upper/normal/lower 데이터
  const upper = useMemo(() =>
    mergeRegionData(effectiveLeftData.upper, effectiveRightData?.upper),
    [effectiveLeftData.upper, effectiveRightData?.upper, mergeRegionData]
  );

  const normal = useMemo(() =>
    mergeRegionData(effectiveLeftData.normal, effectiveRightData?.normal),
    [effectiveLeftData.normal, effectiveRightData?.normal, mergeRegionData]
  );

  const lower = useMemo(() =>
    mergeRegionData(effectiveLeftData.lower, effectiveRightData?.lower),
    [effectiveLeftData.lower, effectiveRightData?.lower, mergeRegionData]
  );

  // 우측 이상치도 고려
  const hasUpperOutliers = upper.hasData;
  const hasLowerOutliers = lower.hasData;

  // 차트 타입 감지
  const isBarChart = chartType === 'column' || chartType === 'stacked' ||
    (chartType === 'mixed' && yFields.some(f => !yFieldTypes || yFieldTypes[f] === 'column')) ||
    (chartType === 'dual-axis' && yFields.some(f => !yFieldTypes || yFieldTypes[f] === 'column'));

  // Column 타입 시리즈 개수 계산
  const columnFieldCount = chartType === 'dual-axis' || chartType === 'mixed'
    ? yFields.filter(f => !yFieldTypes || yFieldTypes[f] === 'column').length
    : yFields.length;

  // Column 타입 시리즈가 2개 이상일 때만 음영 사용 (누적막대는 제외)
  const shouldUseShade = isBarChart && columnFieldCount >= 2 && chartType !== 'stacked';

  // 차트 컨테이너 참조 및 너비 상태
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState<number>(0);

  // normal 영역 참조 및 높이 측정
  const normalRegionRef = useRef<HTMLDivElement>(null);
  const [normalRegionHeight, setNormalRegionHeight] = useState<number>(0);

  // 호버 상태 추적 (통합 보조선용)
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);

  // X축 레이블 영역 높이
  const X_LABEL_HEIGHT = 16;
  const BOTTOM_MARGIN = 12;

  // 영역별 높이 계산 (X축 레이블 및 spacer 고려)
  const upperSpacer = hasUpperOutliers ? 4 : 0;
  const totalReserved = upperSpacer + X_LABEL_HEIGHT + BOTTOM_MARGIN;
  const effectiveTotalHeight = totalHeight - totalReserved;

  // 병합된 데이터로 heights 계산 (좌/우측 이상치 모두 고려)
  const mergedClassifiedData = useMemo(() => ({
    upper,
    normal,
    lower,
  }), [upper, normal, lower]);

  const heights = calculateRegionHeights(mergedClassifiedData, effectiveTotalHeight);

  // 영역별 이상치 필터링
  const upperOutliers = outliers.filter((o) => o.bound === "upper");
  const lowerOutliers = outliers.filter((o) => o.bound === "lower");

  // 차트 너비 및 normal 영역 높이 측정 (단일 ResizeObserver로 통합)
  useEffect(() => {
    let rafId: number | null = null;
    let prevWidth = 0;
    let prevHeight = 0;

    const updateDimensions = () => {
      if (rafId) return;

      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (chartContainerRef.current) {
          const newWidth = chartContainerRef.current.clientWidth;
          if (newWidth > 0 && newWidth !== prevWidth) {
            prevWidth = newWidth;
            setChartWidth(newWidth);
          }
        }
        if (normalRegionRef.current) {
          const newHeight = normalRegionRef.current.clientHeight;
          if (newHeight > 0 && newHeight !== prevHeight) {
            prevHeight = newHeight;
            setNormalRegionHeight(newHeight);
          }
        }
      });
    };

    updateDimensions();

    const observer = new ResizeObserver(updateDimensions);
    if (chartContainerRef.current) {
      observer.observe(chartContainerRef.current);
    }
    if (normalRegionRef.current) {
      observer.observe(normalRegionRef.current);
    }

    return () => {
      observer.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  // X축 레이블 데이터 추출
  const xLabels = fullData.map(d => d[xField] as string);

  // 레이블당 최소 필요 너비
  const LABEL_MIN_WIDTH = 60;

  // 레이블 개수 동적 계산
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

  // 월 단위에서 연도가 바뀌는 레이블 감지
  const yearChangeLabels = useMemo(() => {
    const changes = new Set<string>();

    xLabels.forEach((label, idx) => {
      if (idx === 0) return;

      // 월 패턴인지 확인: YYYY-MM
      if (!/^\d{4}-\d{2}$/.test(label)) return;

      const prevLabel = xLabels[idx - 1];
      const prevYear = prevLabel.substring(0, 4);
      const currYear = label.substring(0, 4);

      // 연도가 바뀌는 경우 4자리 유지
      if (prevYear !== currYear) {
        changes.add(label);
      }
    });

    return changes;
  }, [xLabels]);

  // 통합 호버 핸들러: 모든 영역의 데이터를 통합하여 전달
  const handleUnifiedTooltip = useCallback((payload: any[] | null, label: string | null) => {
    if (!label || !onTooltipChange) {
      setHoveredLabel(null);
      onTooltipChange?.(null, null);
      return;
    }

    setHoveredLabel(label);

    const combinedPayload: any[] = [];

    // 1. Normal 영역에서 정상 데이터 수집
    const normalItem = normal.data.find((d) => d[xField] === label);
    if (normalItem) {
      yFields.forEach((field) => {
        const value = normalItem[field];
        if (value != null) {
          combinedPayload.push({
            dataKey: field,
            value: value,
            payload: normalItem,
          });
        }
      });
    }

    // 2. Upper 영역에서 이상치 수집
    const upperOutliersForDate = upperOutliers.filter((o) => (o.date_display || o.dateDisplay) === label);
    upperOutliersForDate.forEach((outlier, idx) => {
      combinedPayload.push({
        dataKey: `outlier_${idx}`,
        value: outlier.value,
        payload: {
          date_display: label,
          [`outlier_${idx}_field`]: outlier.field,
        },
      });
    });

    // 3. Lower 영역에서 이상치 수집
    const lowerOutliersForDate = lowerOutliers.filter((o) => (o.date_display || o.dateDisplay) === label);
    lowerOutliersForDate.forEach((outlier, idx) => {
      const outlierIdx = upperOutliersForDate.length + idx;
      combinedPayload.push({
        dataKey: `outlier_${outlierIdx}`,
        value: outlier.value,
        payload: {
          date_display: label,
          [`outlier_${outlierIdx}_field`]: outlier.field,
        },
      });
    });

    onTooltipChange(combinedPayload, label);
  }, [normal.data, upperOutliers, lowerOutliers, xField, yFields, onTooltipChange]);

  // X 좌표 계산 (통합 보조선용)
  const hoveredX = useMemo(() => {
    if (!hoveredLabel || !chartWidth) return null;

    const idx = xLabels.indexOf(hoveredLabel);
    if (idx === -1) return null;

    const ratio = xLabels.length > 1 ? (idx / (xLabels.length - 1)) : 0.5;

    // chartWidth는 이미 padding을 뺀 너비 (X축 레이블 영역과 일치)
    // paddingLeft + chartWidth * ratio
    const paddingLeft = chartType === 'dual-axis' ? 60 : 60;
    const offset = idx === 0 ? 0 : -1;
    const xPosition = paddingLeft + (chartWidth * ratio) + offset;

    return xPosition;
  }, [hoveredLabel, chartWidth, xLabels, chartType]);

  // 카테고리 경계 계산 (막대 차트 음영용)
  const hoveredCategoryBounds = useMemo(() => {
    if (!hoveredLabel || !chartWidth || !shouldUseShade) return null;

    const idx = xLabels.indexOf(hoveredLabel);
    if (idx === -1) return null;

    const categoryCount = xLabels.length;

    // Recharts band scale 계산
    const categorySize = chartWidth / categoryCount;
    const categoryCenter = (idx + 0.5) * categorySize;

    // Y축 여백(60px) + 카테고리 중앙에서 절반 뒤로
    const startX = 60 + categoryCenter - (categorySize / 2);
    const width = categorySize;

    return { startX, width };
  }, [hoveredLabel, chartWidth, xLabels, shouldUseShade]);

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      {/* 호버 오버레이: 막대 차트는 음영, 라인 차트는 점선 */}
      {shouldUseShade && hoveredCategoryBounds ? (
        <svg
          style={{
            position: 'absolute',
            left: hoveredCategoryBounds.startX,
            top: 0,
            height: '100%',
            width: hoveredCategoryBounds.width,
            pointerEvents: 'none',
            zIndex: 100,
            overflow: 'visible',
          }}
        >
          <rect
            x="0"
            y="0"
            width={hoveredCategoryBounds.width}
            height="100%"
            fill="rgba(128, 128, 128, 0.05)"
          />
        </svg>
      ) : hoveredX !== null ? (
        <svg
          style={{
            position: 'absolute',
            left: hoveredX - 0.5,
            top: 0,
            height: '100%',
            width: 1,
            pointerEvents: 'none',
            zIndex: 100,
            overflow: 'visible',
          }}
        >
          <line
            x1="0.5"
            y1="0"
            x2="0.5"
            y2="100%"
            stroke={themeColors?.textColor || 'hsl(var(--foreground))'}
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.15"
          />
        </svg>
      ) : null}

      {/* 차트 영역 */}
      <div className="flex flex-col h-full" style={{ gap: 0, overflow: "visible" }}>
      {/* Upper 영역 (상한 이상치) */}
      {hasUpperOutliers && (
        <div style={{ zIndex: 3, overflow: "visible", height: heights.upper, flexShrink: 0 }}>
          <RechartsRegionChart
            data={upper.data}
            fullData={fullData}
            xField={xField}
            yFields={yFields}
            allSeriesFields={allSeriesFields}
            chartType={chartType}
            themeColors={themeColors}
            height={heights.upper}
            yFieldTypes={yFieldTypes}
            yAxisPlacements={yAxisPlacements}
            domain={isDualAxis ? undefined : upper.domain}
            leftDomain={isDualAxis ? effectiveLeftData.upper.domain : undefined}
            rightDomain={isDualAxis ? effectiveRightData?.upper.domain : undefined}
            regionType="upper"
            hasBreakTop={false}
            hasBreakBottom={true}
            showXAxis={false}
            outliers={upperOutliers}
            onTooltipChange={handleUnifiedTooltip}
            hoveredLabel={hoveredLabel}
            datetimeUnit={datetimeUnit}
            chartWidth={chartWidth}
          />
        </div>
      )}

      {/* Upper-Normal 사이 spacer */}
      {hasUpperOutliers && <div style={{ height: 4, flexShrink: 0 }} />}

      {/* Normal 영역 (정상 데이터) - flex-1로 남은 공간 차지 */}
      <div ref={normalRegionRef} style={{ zIndex: 2, overflow: "visible", flex: 1, minHeight: 0 }}>
        <RechartsRegionChart
          data={normal.data}
          fullData={fullData}
          xField={xField}
          yFields={yFields}
          allSeriesFields={allSeriesFields}
          chartType={chartType}
          themeColors={themeColors}
          height={normalRegionHeight > 0 ? normalRegionHeight : heights.normal}
          yFieldTypes={yFieldTypes}
          yAxisPlacements={yAxisPlacements}
          domain={isDualAxis ? undefined : normal.domain}
          leftDomain={isDualAxis ? effectiveLeftData.normal.domain : undefined}
          rightDomain={isDualAxis ? effectiveRightData?.normal.domain : undefined}
          regionType="normal"
          hasBreakTop={hasUpperOutliers}
          hasBreakBottom={hasLowerOutliers}
          showXAxis={false}
          outliers={[]}
          onTooltipChange={handleUnifiedTooltip}
          hoveredLabel={hoveredLabel}
          datetimeUnit={datetimeUnit}
          chartWidth={chartWidth}
          axisUnit={axisUnit}
          leftAxisUnit={leftAxisUnit}
          rightAxisUnit={rightAxisUnit}
        />
      </div>

      {/* X축 레이블 (Normal-Lower 사이, 또는 Lower 없을 때 Normal 아래) */}
      <div
        style={{
          height: X_LABEL_HEIGHT,
          flexShrink: 0,
          paddingLeft: chartType === 'dual-axis' ? 60 : 60,
          paddingRight: chartType === 'dual-axis' ? 60 : 30,
        }}
      >
          <div
            ref={chartContainerRef}
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
            }}
          >
            {xLabels.map((label, idx) => {
              const isFirst = idx === 0;
              const isLast = idx === xLabels.length - 1;

              if (isBarChart) {
                if (!isFirst && isLast) {
                  if (datetimeUnit && datetimeUnit > 1) {
                    if (idx % datetimeUnit !== 0) return null;
                  }
                }
                if (!isFirst && !isLast) {
                  if (datetimeUnit && datetimeUnit > 1) {
                    if (idx % datetimeUnit !== 0) return null;
                  } else if (!shouldShowAll) {
                    const step = Math.ceil(xLabels.length / maxLabels);
                    if (idx % step !== 0) return null;
                  }
                }
              } else {
                if (isFirst || isLast) return null;
                if (datetimeUnit && datetimeUnit > 1) {
                  if (idx % datetimeUnit !== 0) return null;
                } else if (!shouldShowAll) {
                  const step = Math.ceil(xLabels.length / maxLabels);
                  if (idx % step !== 0) return null;
                }
              }

              const leftPercent = xLabels.length > 1
                ? (isBarChart
                    ? ((idx + 0.5) / xLabels.length) * 100
                    : (idx / (xLabels.length - 1)) * 100)
                : 50;

              return (
                <div
                  key={idx}
                  className="text-xs absolute"
                  style={{
                    color: "hsl(var(--muted-foreground))",
                    whiteSpace: 'nowrap',
                    left: `${leftPercent}%`,
                    top: 0,
                    transform: 'translateX(-50%)',
                  }}
                >
                  {yearChangeLabels.has(label) ? label : formatDateForXAxis(label)}
                </div>
              );
            })}
          </div>
        </div>

      {/* Lower 영역 (하한 이상치) */}
      {hasLowerOutliers && (
        <div style={{ zIndex: 1, overflow: "visible", height: heights.lower, flexShrink: 0 }}>
          <RechartsRegionChart
            data={lower.data}
            fullData={fullData}
            xField={xField}
            yFields={yFields}
            allSeriesFields={allSeriesFields}
            chartType={chartType}
            themeColors={themeColors}
            height={heights.lower}
            yFieldTypes={yFieldTypes}
            yAxisPlacements={yAxisPlacements}
            domain={isDualAxis ? undefined : lower.domain}
            leftDomain={isDualAxis ? effectiveLeftData.lower.domain : undefined}
            rightDomain={isDualAxis ? effectiveRightData?.lower.domain : undefined}
            regionType="lower"
            hasBreakTop={true}
            hasBreakBottom={false}
            showXAxis={false}
            outliers={lowerOutliers}
            onTooltipChange={handleUnifiedTooltip}
            hoveredLabel={hoveredLabel}
            datetimeUnit={datetimeUnit}
            chartWidth={chartWidth}
          />
        </div>
      )}

      {/* 하단 여백 */}
      <div style={{ height: BOTTOM_MARGIN, flexShrink: 0 }} />
      </div>
    </div>
  );
}
