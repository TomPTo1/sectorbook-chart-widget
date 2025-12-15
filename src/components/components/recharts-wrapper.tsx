"use client";

import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Scatter,
  ReferenceLine,
} from "recharts";
import type { ChartType, YAxisPlacement } from "../../types/chart-config";
import { formatDateForXAxis } from "../utils/recharts-adapter";
import { getZeroLineStyle } from "./recharts-utils";
import { CustomYAxisLine } from "./custom-y-axis-line";

/** 테마 색상 */
export interface ChartThemeColors {
  textColor: string;
  axisLineColor: string;
  gridColor: string;
  seriesColors: string[];
}

/** CSS 변수에서 색상 값 추출 - 기본값 포함 (sectorbook light mode) */
const DEFAULT_COLORS: Record<string, string> = {
  "--foreground": "hsl(240 10% 3.9%)",
  "--border": "hsl(240 5.9% 90%)",
  "--chart-1": "hsl(12 76% 61%)",
  "--chart-2": "hsl(173 58% 39%)",
  "--chart-3": "hsl(197 37% 24%)",
  "--chart-4": "hsl(43 74% 66%)",
  "--chart-5": "hsl(27 87% 67%)",
  "--chart-6": "hsl(200 70% 50%)",
  "--chart-7": "hsl(140 60% 45%)",
  "--chart-8": "hsl(60 70% 50%)",
};

/** 기본 시리즈 색상 배열 (fallback) */
const FALLBACK_SERIES_COLORS = [
  "hsl(12 76% 61%)", "hsl(173 58% 39%)", "hsl(197 37% 24%)",
  "hsl(43 74% 66%)", "hsl(27 87% 67%)", "hsl(200 70% 50%)",
  "hsl(140 60% 45%)", "hsl(60 70% 50%)",
];

function getCSSVariable(varName: string): string {
  if (typeof window === "undefined") return DEFAULT_COLORS[varName] || "";
  try {
    const root = document.documentElement;
    const value = getComputedStyle(root).getPropertyValue(varName).trim();
    if (!value) return DEFAULT_COLORS[varName] || "";
    if (value.includes(" ")) {
      return `hsl(${value})`;
    }
    return value || DEFAULT_COLORS[varName] || "";
  } catch {
    return DEFAULT_COLORS[varName] || "";
  }
}

/**
 * 축 라인 색상 반환 (CustomYAxisLine과 동일한 스타일)
 * 라이트 모드: hsl(0 0% 44%), 다크 모드: #ffffff
 */
export function getAxisLineColor(): string {
  if (typeof window === "undefined") return "hsl(0 0% 44%)";
  const isDark = document.documentElement.classList.contains('dark');
  return isDark ? "#ffffff" : "hsl(0 0% 44%)";
}

/**
 * 버튼 테두리용 색상 (Y축 색상보다 한 단계 밝음)
 */
export function getButtonBorderColor(color?: string): string {
  if (typeof window === "undefined") return "hsl(0 0% 66%)";
  const isDark = document.documentElement.classList.contains('dark');
  return isDark ? "hsl(0 0% 85%)" : "hsl(0 0% 66%)";
}

/**
 * 두 HEX 색상 사이를 보간하여 새 색상 반환
 * @param startColor 시작 색상 (HEX, e.g., "#F4A87A")
 * @param endColor 끝 색상 (HEX, e.g., "#FADFC7")
 * @param ratio 보간 비율 (0 = startColor, 1 = endColor)
 */
export function interpolateColor(startColor: string, endColor: string, ratio: number): string {
  // HEX를 RGB로 변환
  const parseHex = (hex: string) => {
    const clean = hex.replace('#', '');
    return {
      r: parseInt(clean.substring(0, 2), 16),
      g: parseInt(clean.substring(2, 4), 16),
      b: parseInt(clean.substring(4, 6), 16),
    };
  };

  const start = parseHex(startColor);
  const end = parseHex(endColor);

  // ratio를 0-1 범위로 클램프
  const t = Math.max(0, Math.min(1, ratio));

  // 선형 보간
  const r = Math.round(start.r + (end.r - start.r) * t);
  const g = Math.round(start.g + (end.g - start.g) * t);
  const b = Math.round(start.b + (end.b - start.b) * t);

  // RGB를 HEX로 변환
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * HSL 색상의 밝기를 조정하여 변형 색상 생성
 */
function adjustLightness(hslString: string | undefined, adjustment: number): string {
  // undefined나 빈 문자열 처리
  if (!hslString) return "hsl(220 70% 50%)";

  const match = hslString.match(/hsl\((\d+)\s+([\d.]+)%\s+([\d.]+)%\)/);
  if (!match) return hslString;

  const h = match[1];
  const s = match[2];
  let l = parseFloat(match[3]);

  l = Math.max(20, Math.min(90, l + adjustment));

  return `hsl(${h} ${s}% ${l}%)`;
}

/**
 * 값의 크기(magnitude)에 따라 동적으로 라운딩
 * 예: -420 → -500, -42 → -50, -4200 → -5000
 * 예: 380 → 400, 38 → 40, 3800 → 4000
 */
function roundToNice(value: number, isMax: boolean): number {
  if (value === 0) return 0;

  const absValue = Math.abs(value);
  // 10의 거듭제곱으로 크기 계산 (예: 420 → 100, 42 → 10)
  const magnitude = Math.pow(10, Math.floor(Math.log10(absValue)));

  if (isMax) {
    // 최대값: 올림
    return value >= 0
      ? Math.ceil(value / magnitude) * magnitude
      : Math.floor(value / magnitude) * magnitude;
  } else {
    // 최소값: 내림 (더 넓은 범위)
    return value >= 0
      ? Math.floor(value / magnitude) * magnitude
      : Math.floor(value / magnitude) * magnitude;
  }
}

/**
 * 누적막대 차트의 양수/음수 스택 합계를 계산하여 도메인 반환
 */
function calculateStackedDomain(
  data: any[],
  positiveFields: string[],
  negativeFields: string[]
): [number, number] {
  let posMax = 0;
  let negMin = 0;

  for (const row of data) {
    // 양수 스택 합계
    const posSum = positiveFields.reduce((sum, field) =>
      sum + (typeof row[field] === 'number' ? row[field] : 0), 0);
    posMax = Math.max(posMax, posSum);

    // 음수 스택 합계
    const negSum = negativeFields.reduce((sum, field) =>
      sum + (typeof row[field] === 'number' ? row[field] : 0), 0);
    negMin = Math.min(negMin, negSum);
  }

  // 모두 0인 경우 기본값
  if (posMax === 0 && negMin === 0) {
    return [-10, 10];
  }

  // 라운딩 적용
  const roundedPosMax = roundToNice(posMax, true);
  const roundedNegMin = roundToNice(negMin, false);

  return [roundedNegMin, roundedPosMax];
}

/**
 * 8개 이상 시리즈를 위한 색상 확장
 */
export function expandSeriesColors(baseColors: string[], count: number): string[] {
  // 빈 배열인 경우 fallback 사용
  const colors = baseColors.length > 0 ? baseColors : FALLBACK_SERIES_COLORS;

  if (count <= colors.length) {
    return colors.slice(0, count);
  }

  const expanded = [...colors];
  for (let i = colors.length; i < count; i++) {
    const baseIndex = (i - 8) % colors.length;
    const cycle = Math.floor((i - 8) / colors.length);

    const adjustment = cycle % 2 === 0 ? 15 : -15;
    expanded.push(adjustLightness(colors[baseIndex], adjustment));
  }

  return expanded;
}

/** 테마에 맞는 색상 팔레트 가져오기 */
export function getThemeColors(): ChartThemeColors {
  // 보조선 색상: 배경과 대비되는 색상 사용
  const isDark = typeof window !== "undefined" && document.documentElement.classList.contains('dark');
  const gridColor = isDark ? "hsl(0 0% 25%)" : "hsl(0 0% 85%)";

  const seriesColors = [
    getCSSVariable("--chart-1"),
    getCSSVariable("--chart-2"),
    getCSSVariable("--chart-3"),
    getCSSVariable("--chart-4"),
    getCSSVariable("--chart-5"),
    getCSSVariable("--chart-6"),
    getCSSVariable("--chart-7"),
    getCSSVariable("--chart-8"),
  ].filter(Boolean);

  return {
    textColor: getCSSVariable("--foreground") || "hsl(240 10% 3.9%)",
    axisLineColor: getCSSVariable("--border") || "hsl(240 5.9% 90%)",
    gridColor,
    seriesColors: seriesColors.length > 0 ? seriesColors : FALLBACK_SERIES_COLORS,
  };
}

export interface OutlierDataPoint {
  x: string;
  y: number;
  field: string;
}

export interface RechartsWrapperProps {
  data: Array<Record<string, string | number | [number, number] | null>>;
  xField: string;
  yFields: string[];
  allSeriesFields?: string[];
  chartType: ChartType;
  themeColors?: ChartThemeColors;
  height?: number;
  yFieldTypes?: Record<string, "column" | "line">;
  yAxisPlacements?: Record<string, YAxisPlacement>;
  seriesGroupAssignments?: Record<string, number>;
  outlierData?: OutlierDataPoint[];
  showOutliers?: boolean;
  onTooltipChange?: (payload: any[] | null, label: string | null) => void;
  datetimeUnit?: number;
  axisUnit?: string;      // Y축 단위 (단일축용)
  leftAxisUnit?: string;  // 좌측 Y축 단위 (이중축용)
  rightAxisUnit?: string; // 우측 Y축 단위 (이중축용)
}

export function RechartsWrapper({
  data,
  xField,
  yFields,
  allSeriesFields,
  chartType,
  themeColors,
  height = 300,
  yFieldTypes,
  yAxisPlacements,
  seriesGroupAssignments,
  outlierData,
  showOutliers = true,
  onTooltipChange,
  datetimeUnit = 1,
  axisUnit,
  leftAxisUnit,
  rightAxisUnit,
}: RechartsWrapperProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState<number>(0);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);

  const isColumnChart = chartType === 'column' || chartType === 'stacked' || chartType === 'stacked-100' || chartType === 'stacked-grouped' ||
    (chartType === 'mixed' && yFields.some(f => !yFieldTypes || yFieldTypes[f] === 'column')) ||
    (chartType === 'dual-axis' && yFields.some(f => !yFieldTypes || yFieldTypes[f] === 'column'));

  // Column 타입 시리즈 개수 계산 (이중축/혼합 차트에서는 Column 타입만 카운트)
  const columnFieldCount = chartType === 'dual-axis' || chartType === 'mixed'
    ? yFields.filter(f => !yFieldTypes || yFieldTypes[f] === 'column').length
    : yFields.length;

  // Column 타입 시리즈가 2개 이상일 때만 음영 사용 (누적막대는 제외, 그룹형 누적막대는 포함)
  const shouldUseShade = isColumnChart && columnFieldCount >= 2 && chartType !== 'stacked' && chartType !== 'stacked-100';

  // 누적막대에서 양수/음수 혼합 시리즈를 분리하는 함수
  const transformDataForMixedSeries = useMemo(() => {
    if (chartType !== "stacked" && chartType !== "stacked-100" && chartType !== "stacked-grouped" && chartType !== "area-100") return { data, fields: yFields, fieldStats: [], yAxisDomain: undefined, isPositiveOnly: false, isPercentage: false };

    // 100% 누적막대 또는 100% 영역 차트: 각 시점별로 퍼센트 변환
    if (chartType === "stacked-100" || chartType === "area-100") {
      const percentageData = data.map(row => {
        const newRow: any = { ...row };

        // 해당 시점의 모든 시리즈 값 합계 계산
        let total = 0;
        yFields.forEach(field => {
          const value = row[field];
          if (typeof value === "number" && !isNaN(value)) {
            total += Math.abs(value);
          }
        });

        // 각 값을 퍼센트로 변환하고 원본값 보존
        yFields.forEach(field => {
          const value = row[field];
          if (typeof value === "number" && !isNaN(value)) {
            newRow[`${field}_original`] = value;
            newRow[field] = total > 0 ? (Math.abs(value) / total) * 100 : 0;
          }
        });

        return newRow;
      });

      return {
        data: percentageData,
        fields: yFields,
        fieldStats: [],
        yAxisDomain: [0, 100] as [number, number],
        isPositiveOnly: true,
        isPercentage: true
      };
    }

    // 양수 전용 데이터 체크 (모든 필드의 모든 값이 >= 0)
    const hasAnyNegative = yFields.some(field =>
      data.some(item => {
        const value = item[field];
        return typeof value === "number" && !isNaN(value) && value < 0;
      })
    );

    // 양수 전용 데이터: 분리 로직 스킵, 원본 데이터/필드 그대로 반환
    if (!hasAnyNegative) {
      return {
        data,
        fields: yFields,
        fieldStats: [],
        yAxisDomain: undefined,
        isPositiveOnly: true,
        isPercentage: false
      };
    }

    // 각 필드의 양수/음수 여부 확인
    const fieldStats = yFields.map(field => {
      const values = data
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

    // 혼합 시리즈를 positive/negative로 분리
    const transformedData = data.map(row => {
      const newRow: any = { ...row };

      fieldStats.forEach(({ field, isMixed }) => {
        if (isMixed) {
          const value = row[field];
          if (typeof value === "number") {
            // 양수용 필드: 양수만 유지, 음수는 null
            newRow[`${field}_positive`] = value >= 0 ? value : null;
            // 음수용 필드: 음수만 유지, 양수는 null
            newRow[`${field}_negative`] = value < 0 ? value : null;
          }
        }
      });

      return newRow;
    });

    // 새로운 필드 목록 생성 (원래 yFields 순서 유지)
    const newFields: string[] = [];
    const positiveFields: string[] = [];
    const negativeFields: string[] = [];

    yFields.forEach(field => {
      const stat = fieldStats.find(s => s.field === field);
      if (!stat) return;

      if (stat.isMixed) {
        // 혼합 시리즈: positive와 negative를 연속으로 추가
        newFields.push(`${field}_positive`, `${field}_negative`);
        positiveFields.push(`${field}_positive`);
        negativeFields.push(`${field}_negative`);
      } else {
        // 혼합되지 않은 시리즈: 원래 필드명 사용
        newFields.push(field);
        if (stat.hasPositive && !stat.hasNegative) {
          positiveFields.push(field);
        } else {
          negativeFields.push(field);
        }
      }
    });

    // 누적막대의 도메인 계산
    const yAxisDomain = calculateStackedDomain(transformedData, positiveFields, negativeFields);

    return { data: transformedData, fields: newFields, fieldStats, yAxisDomain, isPositiveOnly: false, isPercentage: false };
  }, [data, yFields, chartType]);

  // 이중축일 때 좌/우측 필드 분리
  const { leftFields, rightFields } = useMemo(() => {
    if (chartType !== 'dual-axis' || !yAxisPlacements) {
      return { leftFields: yFields, rightFields: [] };
    }

    const left = yFields.filter(f => yAxisPlacements[f] === 'left');
    const right = yFields.filter(f => yAxisPlacements[f] === 'right');

    return { leftFields: left, rightFields: right };
  }, [chartType, yFields, yAxisPlacements]);

  const colors = useMemo(() => {
    const baseColors = themeColors?.seriesColors || [
      "hsl(var(--chart-1))",
      "hsl(var(--chart-2))",
      "hsl(var(--chart-3))",
      "hsl(var(--chart-4))",
      "hsl(var(--chart-5))",
      "hsl(var(--chart-6))",
      "hsl(var(--chart-7))",
      "hsl(var(--chart-8))",
    ];
    return expandSeriesColors(baseColors, yFields.length);
  }, [themeColors?.seriesColors, yFields.length]);

  // 누적막대 양수/음수 분할 렌더링 판단
  const shouldSplitStack = useMemo(() => {
    if (chartType !== 'stacked') return false;

    // 양수 전용 데이터는 분할 불필요
    if (transformDataForMixedSeries.isPositiveOnly) return false;

    const { fieldStats } = transformDataForMixedSeries;
    const hasPositive = fieldStats.some(s => s.hasPositive);
    const hasNegative = fieldStats.some(s => s.hasNegative);

    return hasPositive && hasNegative;
  }, [chartType, transformDataForMixedSeries]);

  // 양수/음수 데이터 준비
  const splitStackData = useMemo(() => {
    if (!shouldSplitStack) return null;

    const { data, fields, fieldStats } = transformDataForMixedSeries;

    const positiveFields = fields.filter(f => {
      const originalField = f.replace(/_positive$|_negative$/, '');
      const stat = fieldStats.find(s => s.field === originalField);
      if (f.endsWith('_positive')) return true;
      if (f.endsWith('_negative')) return false;
      return stat?.hasPositive && !stat?.hasNegative;
    });

    const negativeFields = fields.filter(f => {
      const originalField = f.replace(/_positive$|_negative$/, '');
      const stat = fieldStats.find(s => s.field === originalField);
      if (f.endsWith('_negative')) return true;
      if (f.endsWith('_positive')) return false;
      return stat?.hasNegative && !stat?.hasPositive;
    });

    return { data, positiveFields, negativeFields, fieldStats };
  }, [shouldSplitStack, transformDataForMixedSeries]);

  // 색상 매핑 함수
  const getColorForField = useCallback((field: string) => {
    const originalField = field.replace(/_positive$|_negative$/, '');
    const originalSeriesFields = allSeriesFields || yFields;
    const originalIndex = originalSeriesFields.indexOf(originalField);
    return originalIndex >= 0
      ? (themeColors?.seriesColors?.[originalIndex % (themeColors?.seriesColors?.length || 8)] || colors[0])
      : colors[0];
  }, [allSeriesFields, yFields, themeColors?.seriesColors, colors]);

  // Y축 도메인 계산 (분할 차트용)
  const splitDomains = useMemo(() => {
    if (!splitStackData) return null;

    const posMax = calculateStackedDomain(
      splitStackData.data,
      splitStackData.positiveFields,
      []
    )[1];

    const negMin = calculateStackedDomain(
      splitStackData.data,
      [],
      splitStackData.negativeFields
    )[0];

    return {
      positive: [0, posMax] as [number, number],
      negative: [negMin, 0] as [number, number],
    };
  }, [splitStackData]);

  // 이중축 Y축 도메인 계산
  const { leftDomain, rightDomain } = useMemo(() => {
    if (chartType !== 'dual-axis' || !yAxisPlacements) {
      return { leftDomain: undefined, rightDomain: undefined };
    }

    // 좌측 Y축 도메인 계산
    let leftMin = 0, leftMax = 0;
    if (leftFields.length > 0) {
      for (const row of data) {
        for (const field of leftFields) {
          const value = row[field];
          if (typeof value === 'number' && !isNaN(value)) {
            leftMin = Math.min(leftMin, value);
            leftMax = Math.max(leftMax, value);
          }
        }
      }
      leftMin = roundToNice(leftMin, false);
      leftMax = roundToNice(leftMax, true);
    }

    // 우측 Y축 도메인 계산
    let rightMin = 0, rightMax = 0;
    if (rightFields.length > 0) {
      for (const row of data) {
        for (const field of rightFields) {
          const value = row[field];
          if (typeof value === 'number' && !isNaN(value)) {
            rightMin = Math.min(rightMin, value);
            rightMax = Math.max(rightMax, value);
          }
        }
      }
      rightMin = roundToNice(rightMin, false);
      rightMax = roundToNice(rightMax, true);
    }

    return {
      leftDomain: leftFields.length > 0 ? [leftMin, leftMax] as [number, number] : undefined,
      rightDomain: rightFields.length > 0 ? [rightMin, rightMax] as [number, number] : undefined,
    };
  }, [chartType, yAxisPlacements, data, leftFields, rightFields]);

  // 차트 높이 분배 (Y축 도메인 범위 기반)
  const chartHeights = useMemo(() => {
    if (!splitStackData || !splitDomains) {
      return { positive: height / 2, negative: height / 2 };
    }

    // Y축 도메인 범위를 사용하여 높이 비율 계산
    // 이렇게 하면 개별 막대의 시각적 높이가 절대값에 정확히 비례함
    const posRange = Math.abs(splitDomains.positive[1] - splitDomains.positive[0]);
    const negRange = Math.abs(splitDomains.negative[0] - splitDomains.negative[1]);
    const total = posRange + negRange;

    if (total === 0) {
      return { positive: height / 2, negative: height / 2 };
    }

    const positiveHeight = Math.round((posRange / total) * height);
    const negativeHeight = height - positiveHeight;

    return { positive: positiveHeight, negative: negativeHeight };
  }, [splitStackData, splitDomains, height]);

  // 분할 차트 tooltip 통합 핸들러
  const handleUnifiedTooltip = useCallback((label: string | null, payload: any[] | null) => {
    if (!label || !onTooltipChange || !splitStackData) {
      onTooltipChange?.(null, null);
      return;
    }

    const combinedPayload: any[] = [];
    const dataItem = splitStackData.data.find(d => d[xField] === label);

    if (dataItem) {
      // 양수 필드 데이터 수집
      splitStackData.positiveFields.forEach(field => {
        const value = dataItem[field];
        if (value != null && value !== 0) {
          combinedPayload.push({ dataKey: field, value, payload: dataItem });
        }
      });

      // 음수 필드 데이터 수집
      splitStackData.negativeFields.forEach(field => {
        const value = dataItem[field];
        if (value != null && value !== 0) {
          combinedPayload.push({ dataKey: field, value, payload: dataItem });
        }
      });
    }

    onTooltipChange(combinedPayload, label);
  }, [splitStackData, xField, onTooltipChange]);

  // 일반 차트 tooltip 핸들러 (데이터에서 직접 값 가져오기)
  const handleNormalTooltip = useCallback((label: string | null) => {
    if (!label || !onTooltipChange) {
      onTooltipChange?.(null, null);
      return;
    }

    const chartData = transformDataForMixedSeries.data;
    const fields = transformDataForMixedSeries.fields;
    const dataItem = chartData.find(d => d[xField] === label);

    if (!dataItem) {
      onTooltipChange?.(null, null);
      return;
    }

    const combinedPayload: any[] = [];
    fields.forEach(field => {
      const originalField = field.replace(/_positive$|_negative$/, '');
      const value = dataItem[field];
      if (value != null) {
        combinedPayload.push({ dataKey: originalField, value, payload: dataItem });
      }
    });

    onTooltipChange(combinedPayload, label);
  }, [transformDataForMixedSeries, xField, onTooltipChange]);

  // 차트 너비 측정
  useEffect(() => {
    const updateWidth = () => {
      if (chartContainerRef.current) {
        const chartArea = chartContainerRef.current.clientWidth;
        setChartWidth(chartArea);
      }
    };

    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    if (chartContainerRef.current) {
      observer.observe(chartContainerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // X축 레이블 필터링 로직
  const LABEL_MIN_WIDTH = 60;
  const xLabels = data.map((d) => d[xField] as string);

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

  // 표시할 X축 틱 계산 (첫 번째와 마지막 제외)
  const visibleTicks = useMemo(() => {
    const ticks: string[] = [];

    xLabels.forEach((label, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === xLabels.length - 1;

      // 컬럼차트: 첫/마지막 조건부 표시
      if (isColumnChart) {
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
      if (datetimeUnit && datetimeUnit > 1) {
        if (idx % datetimeUnit === 0) {
          ticks.push(label);
        }
        return;
      }

      // 모두 표시
      if (shouldShowAll) {
        ticks.push(label);
        return;
      }

      // 간격에 따라 표시
      const step = Math.ceil(xLabels.length / maxLabels);
      if (idx % step === 0) {
        ticks.push(label);
      }
    });

    return ticks;
  }, [xLabels, shouldShowAll, maxLabels, datetimeUnit, isColumnChart]);

  // 월 단위에서 연도가 바뀌는 레이블 감지
  const yearChangeLabels = useMemo(() => {
    const changes = new Set<string>();

    xLabels.forEach((label, idx) => {
      if (idx === 0) return; // 첫 레이블은 비교할 이전 값 없음

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

  // 카테고리 경계 계산 (막대 차트 음영용)
  const hoveredCategoryBounds = useMemo(() => {
    if (!hoveredLabel || !chartWidth || !shouldUseShade) return null;

    const idx = xLabels.findIndex(label => label === hoveredLabel);
    if (idx === -1) return null;

    // Recharts 레이아웃 상수
    const MARGIN_RIGHT = 30;  // ResponsiveContainer margin.right
    const Y_AXIS_WIDTH = 60;  // YAxis width

    // 실제 차트(플롯) 영역 너비 계산
    const plotAreaWidth = chartWidth - MARGIN_RIGHT - Y_AXIS_WIDTH;
    const categoryCount = xLabels.length;
    const categorySize = plotAreaWidth / categoryCount;

    // 카테고리 시작 위치 계산
    const categoryStart = Y_AXIS_WIDTH + (idx * categorySize);
    const startX = categoryStart;
    const width = categorySize;

    return { startX, width };
  }, [hoveredLabel, chartWidth, xLabels, shouldUseShade]);

  // 분할 누적차트 호버 보조선 X 좌표 계산
  const splitStackHoveredX = useMemo(() => {
    if (!shouldSplitStack || !hoveredLabel || !chartWidth) return null;

    const idx = xLabels.findIndex(label => label === hoveredLabel);
    if (idx === -1) return null;

    const MARGIN_RIGHT = 30;
    const Y_AXIS_WIDTH = 60;
    const plotAreaWidth = chartWidth - MARGIN_RIGHT - Y_AXIS_WIDTH;
    const categorySize = plotAreaWidth / xLabels.length;

    // 막대 차트는 카테고리 중앙에 위치
    const categoryCenter = (idx + 0.5) * categorySize;
    return Y_AXIS_WIDTH + categoryCenter;
  }, [shouldSplitStack, hoveredLabel, chartWidth, xLabels]);

  const renderSeries = () => {
    const { fields: renderFields, fieldStats } = transformDataForMixedSeries;

    // Column과 Line 시리즈를 분리하여 Column이 먼저, Line이 나중에 렌더링되도록 함
    // (recharts에서 나중에 렌더링된 요소가 위에 표시됨)
    const columnSeries: React.ReactElement[] = [];
    const lineSeries: React.ReactElement[] = [];

    // 누적막대에서 마지막 Column 시리즈 인덱스 계산
    const columnFields = renderFields.filter((field) => {
      const originalField = field.replace(/_positive$|_negative$/, '');
      if (chartType === "line") return false;
      if (chartType === "mixed" || chartType === "dual-axis") {
        return (yFieldTypes?.[originalField] ?? "column") === "column";
      }
      return true;
    });
    const lastColumnFieldIndex = columnFields.length - 1;
    let currentColumnIndex = 0;

    // 그룹형 누적막대: 각 그룹별 마지막 시리즈 계산
    const lastFieldInGroup: Record<number, string> = {};
    if (chartType === "stacked-grouped" && seriesGroupAssignments) {
      renderFields.forEach((field) => {
        const origField = field.replace(/_positive$|_negative$/, '');
        const groupNum = seriesGroupAssignments[origField] || 1;
        if (groupNum > 0) {
          lastFieldInGroup[groupNum] = origField;
        }
      });
    }

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
      let seriesType: "column" | "line" | "area";
      if (chartType === "line") {
        seriesType = "line";
      } else if (chartType === "area" || chartType === "area-100" || chartType === "stacked-area") {
        seriesType = "area";
      } else if (chartType === "mixed" || chartType === "dual-axis") {
        // 혼합 차트 or 이중축: yFieldTypes에서 지정한 타입 사용, 기본값은 "column"
        seriesType = yFieldTypes?.[originalField] ?? "column";
      } else {
        // column, stacked 등: 막대
        seriesType = "column";
      }

      // 이중축일 때 yAxisId 지정
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
            activeDot={{ fill: color, stroke: color, strokeWidth: 0, r: 5 }}
            yAxisId={yAxisId}
          />
        );
      } else if (seriesType === "area") {
        lineSeries.push(
          <Area
            key={field}
            type="monotone"
            dataKey={field}
            stroke={color}
            fill={color}
            fillOpacity={0.3}
            strokeWidth={2}
            dot={false}
            activeDot={{ fill: color, stroke: color, strokeWidth: 0, r: 5 }}
            yAxisId={yAxisId}
            stackId={(chartType === "area-100" || chartType === "stacked-area") ? "area-stack" : undefined}
          />
        );
      } else {
        // 라운딩 처리 로직
        const isLastColumn = currentColumnIndex === lastColumnFieldIndex;
        let columnRadius: number | [number, number, number, number];

        if (chartType === "stacked" || chartType === "stacked-100") {
          // 누적 막대: 마지막 시리즈만 위쪽 라운딩
          columnRadius = isLastColumn ? [2, 2, 0, 0] : 0;
        } else if (chartType === "stacked-grouped" && seriesGroupAssignments) {
          // 그룹형 누적막대: 각 그룹별 마지막 시리즈만 라운딩
          const groupNum = seriesGroupAssignments[originalField] || 1;
          const isLastInGroup = lastFieldInGroup[groupNum] === originalField;
          columnRadius = isLastInGroup ? [2, 2, 0, 0] : 0;
        } else {
          // 일반 막대: 모든 막대 위쪽만 라운딩
          columnRadius = [2, 2, 0, 0];
        }

        // stackId 결정: 그룹형 누적막대는 그룹별로 다른 stackId 사용
        let stackId: string | undefined;
        if (chartType === "stacked-grouped" && seriesGroupAssignments) {
          const groupNum = seriesGroupAssignments[originalField] || 1;
          stackId = `group${groupNum}`;
        } else if (chartType === "stacked" || chartType === "stacked-100") {
          stackId = "stack";
        }

        columnSeries.push(
          <Bar
            key={field}
            dataKey={field}
            fill={color}
            radius={columnRadius}
            stackId={stackId}
            yAxisId={yAxisId}
          />
        );
        currentColumnIndex++;
      }
    });

    // Column 먼저, Line 나중에 렌더링 (Line이 막대 위에 표시됨)
    return [...columnSeries, ...lineSeries];
  };

  // 일반 차트용 y=0 선 스타일 계산 (조건부 렌더링 밖에서 항상 호출)
  const zeroLineStyleForNormalChart = useMemo(() => {
    const style = (chartType === "stacked" || chartType === "stacked-grouped")
      ? getZeroLineStyle(data, yFields)
      : getZeroLineStyle(transformDataForMixedSeries.data, transformDataForMixedSeries.fields);
    return style;
  }, [data, yFields, transformDataForMixedSeries, chartType, yFieldTypes]);

  return (
    <div ref={chartContainerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {shouldSplitStack && splitStackData && splitDomains ? (
        <>
        {/* 누적막대 분할 차트 호버 보조선 */}
        {splitStackHoveredX !== null && (
          <svg
            style={{
              position: 'absolute',
              left: splitStackHoveredX - 0.5,
              top: 0,
              height: height,
              width: 1,
              pointerEvents: 'none',
              zIndex: 1,
              overflow: 'visible',
            }}
          >
            <line
              x1="0.5"
              y1="0"
              x2="0.5"
              y2={height - 40}
              stroke={themeColors?.textColor || "hsl(var(--foreground))"}
              strokeWidth={1}
              strokeDasharray="4 4"
              strokeOpacity={0.15}
            />
          </svg>
        )}

        {/* 누적막대 양수/음수 분할 렌더링 */}
        <div className="flex flex-col" style={{
          gap: 0,
          height,
          overflow: 'visible',
          position: 'relative',
          zIndex: 2
        }}>
          {/* 양수 차트 (상단) */}
          {splitStackData.positiveFields.length > 0 && (
            <div style={{ height: chartHeights.positive, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={splitStackData.data}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  onMouseMove={(state: any) => {
                    if (state && state.activeLabel) {
                      setHoveredLabel(state.activeLabel);
                      handleUnifiedTooltip(state.activeLabel, state.activePayload);
                    }
                  }}
                  onMouseLeave={() => {
                    setHoveredLabel(null);
                    onTooltipChange?.(null, null);
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={themeColors?.gridColor || "hsl(0 0% 85%)"}
                    opacity={0.5}
                  />
                  <XAxis
                    dataKey={xField}
                    hide={true}
                  />
                  <YAxis
                    yAxisId="default"
                    domain={splitDomains.positive}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: getAxisLineColor(), strokeWidth: 1.5 }}
                    tickFormatter={(value) => {
                      if (typeof value === "number") {
                        if (Math.abs(value) >= 1000000) {
                          return `${(value / 1000000).toFixed(1)}M`;
                        }
                        if (Math.abs(value) >= 1000) {
                          return `${(value / 1000).toFixed(1)}K`;
                        }
                      }
                      return value;
                    }}
                  />
                  <Tooltip cursor={false} content={() => null} />
                  <Legend wrapperStyle={{ display: "none" }} />
                  {splitStackData.positiveFields.map((field, index) => (
                    <Bar
                      key={field}
                      dataKey={field}
                      fill={getColorForField(field)}
                      stackId="positive"
                      radius={index === splitStackData.positiveFields.length - 1 ? [2, 2, 0, 0] : 0}
                      yAxisId="default"
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* 음수 차트 (하단) */}
          {splitStackData.negativeFields.length > 0 && (
            <div style={{ height: chartHeights.negative, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={splitStackData.data}
                  margin={{ top: 0, right: 30, left: 0, bottom: 10 }}
                  onMouseMove={(state: any) => {
                    if (state && state.activeLabel) {
                      setHoveredLabel(state.activeLabel);
                      handleUnifiedTooltip(state.activeLabel, state.activePayload);
                    }
                  }}
                  onMouseLeave={() => {
                    setHoveredLabel(null);
                    onTooltipChange?.(null, null);
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={themeColors?.gridColor || "hsl(0 0% 85%)"}
                    opacity={0.5}
                  />
                  <XAxis
                    dataKey={xField}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: getAxisLineColor(), strokeWidth: 1.5 }}
                    angle={0}
                    textAnchor="middle"
                    height={30}
                    ticks={visibleTicks}
                    tickFormatter={(value) => {
                      if (yearChangeLabels.has(value)) {
                        return value;
                      }
                      return formatDateForXAxis(value);
                    }}
                  />
                  <YAxis
                    yAxisId="default"
                    domain={splitDomains.negative}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: getAxisLineColor(), strokeWidth: 1.5 }}
                    tickFormatter={(value) => {
                      if (typeof value === "number") {
                        if (Math.abs(value) >= 1000000) {
                          return `${(value / 1000000).toFixed(1)}M`;
                        }
                        if (Math.abs(value) >= 1000) {
                          return `${(value / 1000).toFixed(1)}K`;
                        }
                      }
                      return value;
                    }}
                  />
                  <ReferenceLine
                    y={0}
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={1}
                    opacity={0.5}
                    yAxisId="default"
                  />
                  <Tooltip cursor={false} content={() => null} />
                  <Legend wrapperStyle={{ display: "none" }} />
                  {splitStackData.negativeFields.map((field, index) => (
                    <Bar
                      key={field}
                      dataKey={field}
                      fill={getColorForField(field)}
                      stackId="negative"
                      radius={index === splitStackData.negativeFields.length - 1 ? [0, 0, 2, 2] : 0}
                      yAxisId="default"
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </>
      ) : (
        // 기존 단일 차트 렌더링
        <>
        <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={transformDataForMixedSeries.data}
          margin={chartType === 'dual-axis'
            ? { top: 10, right: 10, left: 0, bottom: 0 }
            : { top: 10, right: 30, left: 0, bottom: 0 }
          }
          onMouseMove={(state: any) => {
            if (state && state.activeLabel) {
              setHoveredLabel(state.activeLabel);
              handleNormalTooltip(state.activeLabel);
            }
          }}
          onMouseLeave={() => {
            setHoveredLabel(null);
            onTooltipChange?.(null, null);
          }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={themeColors?.gridColor || "hsl(0 0% 85%)"}
            opacity={0.5}
          />
          <XAxis
            dataKey={xField}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: getAxisLineColor(), strokeWidth: 1.5 }}
            angle={0}
            textAnchor="middle"
            height={30}
            ticks={visibleTicks}
            tickFormatter={(value) => {
              // 월 단위에서 연도가 바뀌는 레이블은 4자리 유지
              if (yearChangeLabels.has(value)) {
                return value;
              }
              return formatDateForXAxis(value);
            }}
          />
        {/* 좌측 Y축 - 이중축일 때만 표시 */}
        <YAxis
          yAxisId="left"
          orientation="left"
          width={chartType === 'dual-axis' ? 50 : 0}
          tick={chartType === 'dual-axis' ? { fill: "hsl(var(--muted-foreground))", fontSize: 12 } : false}
          tickLine={false}
          axisLine={chartType === 'dual-axis' ? { stroke: getAxisLineColor(), strokeWidth: 1.5 } : false}
          tickFormatter={(value) => {
            if (typeof value === "number") {
              if (Math.abs(value) >= 1000000) {
                return `${(value / 1000000).toFixed(1)}M`;
              }
              if (Math.abs(value) >= 1000) {
                return `${(value / 1000).toFixed(1)}K`;
              }
            }
            return value;
          }}
          label={chartType === 'dual-axis' && leftAxisUnit ? {
            value: `(${leftAxisUnit})`,
            position: 'insideTopLeft',
            style: { textAnchor: 'start', fill: 'hsl(var(--muted-foreground))', fontSize: 10 },
            offset: 0,
            dy: 20,
          } : undefined}
        />

        {/* 우측 Y축 - 이중축일 때만 표시 */}
        <YAxis
          yAxisId="right"
          orientation="right"
          width={chartType === 'dual-axis' ? 50 : 0}
          tick={chartType === 'dual-axis' ? { fill: "hsl(var(--muted-foreground))", fontSize: 12 } : false}
          tickLine={false}
          axisLine={chartType === 'dual-axis' ? { stroke: getAxisLineColor(), strokeWidth: 1.5 } : false}
          tickFormatter={(value) => {
            if (typeof value === "number") {
              if (Math.abs(value) >= 1000000) {
                return `${(value / 1000000).toFixed(1)}M`;
              }
              if (Math.abs(value) >= 1000) {
                return `${(value / 1000).toFixed(1)}K`;
              }
            }
            return value;
          }}
          label={chartType === 'dual-axis' && rightAxisUnit ? {
            value: `(${rightAxisUnit})`,
            position: 'insideTopRight',
            style: { textAnchor: 'end', fill: 'hsl(var(--muted-foreground))', fontSize: 10 },
            offset: 0,
            dy: 20,
          } : undefined}
        />

        {/* 기본 Y축 - 이중축일 때는 숨김 */}
        <YAxis
          yAxisId="default"
          width={chartType === 'dual-axis' ? 0 : 60}
          domain={(chartType === "stacked" || chartType === "stacked-100" || chartType === "stacked-grouped" || chartType === "area-100") && transformDataForMixedSeries.yAxisDomain ? transformDataForMixedSeries.yAxisDomain : undefined}
          tick={chartType === 'dual-axis' ? false : { fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          tickLine={false}
          axisLine={chartType === 'dual-axis' ? false : { stroke: getAxisLineColor(), strokeWidth: 1.5 }}
          tickFormatter={(value) => {
            if (typeof value === "number") {
              // 100% 누적막대 또는 100% 영역: 퍼센트 표시
              if (chartType === "stacked-100" || chartType === "area-100") {
                return `${value.toFixed(0)}%`;
              }
              if (Math.abs(value) >= 1000000) {
                return `${(value / 1000000).toFixed(1)}M`;
              }
              if (Math.abs(value) >= 1000) {
                return `${(value / 1000).toFixed(1)}K`;
              }
            }
            return value;
          }}
          label={chartType !== 'dual-axis' && axisUnit ? {
            value: `(${axisUnit})`,
            position: 'insideTopLeft',
            style: { textAnchor: 'start', fill: 'hsl(var(--muted-foreground))', fontSize: 10 },
            offset: 0,
            dy: 20,
          } : undefined}
        />
          {(() => {
            if (!zeroLineStyleForNormalChart.useSolid) {
              // 점선
              return (
                <ReferenceLine
                  y={0}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                  opacity={0.5}
                  yAxisId={chartType === 'dual-axis' ? 'left' : 'default'}
                />
              );
            }

            if (zeroLineStyleForNormalChart.useAxisStyle) {
              // 축선 스타일 실선
              return (
                <ReferenceLine
                  y={0}
                  stroke={getAxisLineColor()}
                  strokeWidth={1.5}
                  yAxisId={chartType === 'dual-axis' ? 'left' : 'default'}
                />
              );
            }

            // 현재 스타일 실선
            return (
              <ReferenceLine
                y={0}
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={1}
                opacity={0.5}
                yAxisId={chartType === 'dual-axis' ? 'left' : 'default'}
              />
            );
          })()}
        <Tooltip
          cursor={
            shouldUseShade ? false : {
              stroke: themeColors?.textColor || "hsl(var(--foreground))",
              strokeOpacity: 0.15,
              strokeWidth: 1,
              strokeDasharray: "4 4",
            }
          }
          content={() => null}
        />
        <Legend
          wrapperStyle={{ display: "none" }}
        />
        {renderSeries()}
        {showOutliers && outlierData && outlierData.length > 0 && (
          <Scatter
            name="이상치"
            data={outlierData.map((o) => ({
              [xField]: o.x,
              outlierValue: o.y,
            }))}
            dataKey="outlierValue"
            fill="#ef4444"
            shape="circle"
            yAxisId={chartType === 'dual-axis' ? 'right' : 'default'}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
    {/* 막대 차트 호버 음영 (시리즈 2개 이상) */}
    {shouldUseShade && hoveredCategoryBounds && (() => {
      const X_AXIS_HEIGHT = 30;  // XAxis height
      const shadeHeight = height - 10 - X_AXIS_HEIGHT;

      return (
        <svg
          style={{
            position: 'absolute',
            left: hoveredCategoryBounds.startX,
            top: 10,
            height: shadeHeight,
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
            height={shadeHeight}
            fill="rgba(128, 128, 128, 0.05)"
          />
        </svg>
      );
    })()}
        </>
      )}
    </div>
  );
}
