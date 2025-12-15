"use client";

import { cn } from "../../utils/cn";
import type { ChartType, LegendValueState, YAxisPlacement } from "../../types/chart-config";

interface LegendItemProps {
  name: string;
  color: string;
  enabled: boolean;
  value: number | null;
  originalValue?: number | null;
  valueState: LegendValueState;
  onClick: () => void;
  chartType?: ChartType;
  yFieldTypes?: Record<string, "column" | "line">;
  yAxisPlacement?: YAxisPlacement;
  isMixedChart?: boolean;
  onTypeChange?: (field: string, type: "column" | "line" | "none") => void;
}

export function LegendItem({
  name,
  color,
  enabled,
  value,
  originalValue,
  valueState,
  onClick,
  chartType,
  yFieldTypes,
  yAxisPlacement,
  isMixedChart,
  onTypeChange,
}: LegendItemProps) {
  // 시리즈 타입 결정 (마커 렌더링용)
  const getSeriesType = (): "line" | "bar" | "pie" | "treemap" => {
    if (chartType === "pie" || chartType === "two-level-pie") return "pie";
    if (chartType === "treemap" || chartType === "multi-level-treemap") return "treemap";
    if (chartType === "column" || chartType === "stacked" || chartType === "stacked-100") return "bar";
    if ((chartType === "mixed" || chartType === "dual-axis") && yFieldTypes?.[name]) {
      // yFieldTypes의 "column" 값을 마커 렌더링용 "bar"로 변환
      return yFieldTypes[name] === 'column' ? 'bar' : 'line';
    }
    return "line";
  };

  const seriesType = getSeriesType();

  // 값 포맷팅
  const formatDisplayValue = () => {
    if (valueState === 'missing') return '-';
    if (value === null) return '';

    // 100% 누적막대: 원본값 (퍼센트%) 형식
    if (chartType === "stacked-100" && originalValue !== null && originalValue !== undefined) {
      const percentValue = value.toFixed(1);
      return `${originalValue.toLocaleString()} (${percentValue}%)`;
    }

    return value.toLocaleString();
  };

  const displayValue = formatDisplayValue();

  // 값 색상 (inline style로 강제 적용)
  const getValueStyle = () => {
    if (valueState === 'outlier') {
      return { color: '#ef4444', fontWeight: 'bold' };
    }
    return undefined;
  };

  const getValueColor = () => {
    if (valueState === 'missing') return 'text-muted-foreground';
    if (valueState === 'outlier') return '!text-red-500';
    return 'text-foreground';
  };

  return (
    <div className="w-full">
      <button
        onClick={onClick}
        className={cn(
          "flex items-center justify-between gap-2 w-full px-0 py-2.5 rounded-lg",
          "cursor-pointer transition-all duration-200 text-left",
          enabled
            ? "hover:scale-[1.02]"
            : "opacity-50"
        )}
        title={`${name} [${valueState}]`}
      >
        {/* 색상 인디케이터 */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {seriesType === "pie" ? (
            // 파이 차트 마커: 원형
            <div
              style={{
                width: '10px',
                height: '10px',
                backgroundColor: color,
                borderRadius: '50%',
                flexShrink: 0,
              }}
            />
          ) : seriesType === "line" ? (
            // 라인 차트 마커: 단일 선
            <div
              style={{
                width: '12px',
                height: '3px',
                backgroundColor: color,
                flexShrink: 0,
              }}
            />
          ) : seriesType === "treemap" ? (
            // 트리맵 마커: 8x8 직사각형 (멀티레벨 트리맵과 동일)
            <div
              style={{
                width: '8px',
                height: '8px',
                backgroundColor: color,
                flexShrink: 0,
              }}
            />
          ) : (
            // 막대 차트 마커: 직사각형 박스
            <div
              style={{
                width: '12px',
                height: '8px',
                backgroundColor: color,
                borderRadius: '2px',
                flexShrink: 0,
              }}
            />
          )}

          {/* 시리즈명 */}
          <span className={cn(
            "text-xs font-semibold truncate text-muted-foreground",
            !enabled && "opacity-60"
          )}>
            {name}
            {/* 이중축 배치 표시 뱃지 */}
            {yAxisPlacement && (
              <span className="ml-1 text-[10px] text-muted-foreground/70">
                ({yAxisPlacement === 'right' ? '우' : '좌'})
              </span>
            )}
          </span>
        </div>

        {/* 값 (우측 정렬) */}
        {displayValue && (
          <span
            className={cn(
              "text-xs font-mono tabular-nums flex-shrink-0",
              enabled ? "font-bold" : "font-semibold",
              getValueColor()
            )}
            style={getValueStyle()}
          >
            {displayValue}
          </span>
        )}
      </button>
    </div>
  );
}
