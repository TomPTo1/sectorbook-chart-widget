"use client";

import React, { useMemo, useCallback } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import type { ChartThemeColors } from "./recharts-wrapper";
import { expandSeriesColors } from "./recharts-wrapper";

// 2단계 원형 차트 전용 색상 팔레트
export const TWO_LEVEL_PIE_COLORS = [
  "hsl(180 7% 54%)",   // #819292
  "hsl(27 19% 57%)",   // #A7907D
  "hsl(72 11% 55%)",   // #949980
  "hsl(129 10% 58%)",  // #899E8C
  "hsl(207 13% 48%)",  // #6B7C8A
  "hsl(166 9% 47%)",   // #6C827D
];

export interface TwoLevelPieInnerDataItem {
  name: string;
  value: number;
}

export interface TwoLevelPieOuterDataItem {
  name: string;
  value: number;
  series: string;
}

export interface RechartsTwoLevelPieWrapperProps {
  innerData: TwoLevelPieInnerDataItem[];
  outerData: TwoLevelPieOuterDataItem[];
  enabledSeries: Set<string>;
  themeColors?: ChartThemeColors;
  height?: number;
  allSeriesFields: string[];
  onTooltipChange?: (payload: any[] | null, label: string | null) => void;
}

/**
 * HSL 색상의 밝기를 조정하여 변형 색상 생성
 */
function adjustLightness(hslString: string, adjustment: number): string {
  const match = hslString.match(/hsl\((\d+)\s+([\d.]+)%\s+([\d.]+)%\)/);
  if (!match) return hslString;

  const h = match[1];
  const s = match[2];
  let l = parseFloat(match[3]);

  l = Math.max(20, Math.min(90, l + adjustment));

  return `hsl(${h} ${s}% ${l}%)`;
}

export function RechartsTwoLevelPieWrapper({
  innerData,
  outerData,
  enabledSeries,
  themeColors,
  height = 400,
  allSeriesFields,
  onTooltipChange,
}: RechartsTwoLevelPieWrapperProps) {
  // 2단계 원형 차트 전용 색상 사용
  const colors = useMemo(() => {
    return expandSeriesColors(TWO_LEVEL_PIE_COLORS, allSeriesFields.length);
  }, [allSeriesFields.length]);

  // 시리즈별 색상 조회
  const getColorForSeries = useCallback(
    (seriesName: string) => {
      const idx = allSeriesFields.indexOf(seriesName);
      return idx >= 0 ? colors[idx % colors.length] : colors[0];
    },
    [allSeriesFields, colors]
  );

  // enabledSeries 기반 내부 데이터 필터링
  const filteredInnerData = useMemo(() => {
    return innerData.filter((item) => enabledSeries.has(item.name));
  }, [innerData, enabledSeries]);

  // enabledSeries 기반 외부 데이터 필터링
  const filteredOuterData = useMemo(() => {
    return outerData.filter((item) => enabledSeries.has(item.series));
  }, [outerData, enabledSeries]);

  // 내부 원의 각 시리즈별 시작/끝 각도 계산
  const innerAngles = useMemo(() => {
    const total = filteredInnerData.reduce((sum, d) => sum + d.value, 0);
    if (total === 0) return [];

    let currentAngle = 90; // Recharts 기본 시작 각도

    return filteredInnerData.map((item) => {
      const angle = (item.value / total) * 360;
      const result = {
        name: item.name,
        startAngle: currentAngle,
        endAngle: currentAngle - angle,
      };
      currentAngle -= angle;
      return result;
    });
  }, [filteredInnerData]);

  // 내부 원 호버 핸들러
  const onInnerPieEnter = useCallback(
    (_: any, index: number) => {
      const item = filteredInnerData[index];
      if (item && onTooltipChange) {
        onTooltipChange([{ dataKey: item.name, value: item.value, payload: item }], item.name);
      }
    },
    [filteredInnerData, onTooltipChange]
  );

  const onPieLeave = useCallback(() => {
    onTooltipChange?.(null, null);
  }, [onTooltipChange]);

  // 전체 외부 데이터 합계 계산 (라벨 표시 조건용)
  const allOuterSum = useMemo(() => {
    return filteredOuterData.reduce((sum, d) => sum + d.value, 0);
  }, [filteredOuterData]);

  if (filteredInnerData.length === 0 && filteredOuterData.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <span className="text-muted-foreground text-sm">표시할 시리즈가 없습니다</span>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart margin={{ top: 40, right: 80, bottom: 40, left: 80 }}>
        {/* 내부 원 - 시리즈별 합계 */}
        <Pie
          data={filteredInnerData as any}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius="50%"
          startAngle={90}
          endAngle={-270}
          onMouseEnter={onInnerPieEnter}
          onMouseLeave={onPieLeave}
        >
          {filteredInnerData.map((entry) => (
            <Cell key={`inner-${entry.name}`} fill={getColorForSeries(entry.name)} />
          ))}
        </Pie>
        {/* 외부 링 - 시리즈별 연도별 값 (내부 원 각도에 맞춰 정렬) */}
        {innerAngles.map((seriesAngle) => {
          const seriesOuterData = filteredOuterData.filter(
            (d) => d.series === seriesAngle.name
          );

          if (seriesOuterData.length === 0) return null;

          return (
            <Pie
              key={`outer-${seriesAngle.name}`}
              data={seriesOuterData as any}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              startAngle={seriesAngle.startAngle}
              endAngle={seriesAngle.endAngle}
              innerRadius="60%"
              outerRadius="80%"
              label={(props) => {
                const { value } = props;
                const absolutePercent = value / allOuterSum;
                // 전체 합계 대비 1% 미만이면 라벨 숨김
                if (absolutePercent < 0.01) return null;
                return value.toLocaleString();
              }}
              labelLine={true}
              onMouseEnter={(_: any, index: number) => {
                const item = seriesOuterData[index];
                if (item && onTooltipChange) {
                  onTooltipChange(
                    [{ dataKey: item.series, value: item.value, payload: item, name: item.name }],
                    item.name
                  );
                }
              }}
              onMouseLeave={onPieLeave}
            >
              {seriesOuterData.map((entry, idx) => {
                // 연도 개수에 따라 동적으로 밝기 조정 범위 계산
                const lightnessStep = seriesOuterData.length > 1
                  ? 20 / (seriesOuterData.length - 1)
                  : 0;
                const adjustment = 10 - idx * lightnessStep;

                return (
                  <Cell
                    key={`outer-${entry.name}-${idx}`}
                    fill={adjustLightness(getColorForSeries(entry.series), adjustment)}
                  />
                );
              })}
            </Pie>
          );
        })}
      </PieChart>
    </ResponsiveContainer>
  );
}
