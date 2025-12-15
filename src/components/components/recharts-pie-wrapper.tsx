"use client";

import React, { useMemo, useState, useCallback } from "react";
import { PieChart, Pie, Cell, Tooltip, Sector, ResponsiveContainer } from "recharts";
import type { ChartThemeColors } from "./recharts-wrapper";
import { expandSeriesColors } from "./recharts-wrapper";

export interface PieChartDataItem {
  name: string;
  value: number;
}

export interface RechartsPieWrapperProps {
  data: PieChartDataItem[];
  enabledSeries: Set<string>;
  themeColors?: ChartThemeColors;
  height?: number;
  allSeriesFields: string[];
  onTooltipChange?: (payload: any[] | null, label: string | null) => void;
}

/** 호버 시 강조 효과를 위한 활성 섹터 렌더러 */
const renderActiveShape = (props: any) => {
  const RADIAN = Math.PI / 180;
  const {
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill,
    payload,
    percent,
    value,
  } = props;

  const sin = Math.sin(-RADIAN * (midAngle ?? 0));
  const cos = Math.cos(-RADIAN * (midAngle ?? 0));
  const sx = (cx ?? 0) + ((outerRadius ?? 0) + 10) * cos;
  const sy = (cy ?? 0) + ((outerRadius ?? 0) + 10) * sin;
  const mx = (cx ?? 0) + ((outerRadius ?? 0) + 30) * cos;
  const my = (cy ?? 0) + ((outerRadius ?? 0) + 30) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 22;
  const ey = my;
  const textAnchor = cos >= 0 ? "start" : "end";

  return (
    <g>
      {/* 중앙 시리즈명 */}
      <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill}>
        {payload?.name}
      </text>
      {/* 기본 섹터 */}
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      {/* 외부 링 */}
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={(outerRadius ?? 0) + 6}
        outerRadius={(outerRadius ?? 0) + 10}
        fill={fill}
      />
      {/* 연결선 */}
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
      {/* 연결점 */}
      <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
      {/* 값 텍스트 */}
      <text
        x={ex + (cos >= 0 ? 1 : -1) * 12}
        y={ey}
        textAnchor={textAnchor}
        className="fill-foreground"
        style={{ fontSize: 12 }}
      >
        {`${payload?.name} ${(value ?? 0).toLocaleString()}`}
      </text>
      {/* 비율 텍스트 */}
      <text
        x={ex + (cos >= 0 ? 1 : -1) * 12}
        y={ey}
        dy={18}
        textAnchor={textAnchor}
        className="fill-muted-foreground"
        style={{ fontSize: 12 }}
      >
        {`(Rate ${((percent ?? 0) * 100).toFixed(2)}%)`}
      </text>
    </g>
  );
};

export function RechartsPieWrapper({
  data,
  enabledSeries,
  themeColors,
  height = 400,
  allSeriesFields,
  onTooltipChange,
}: RechartsPieWrapperProps) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  // enabledSeries 기반 데이터 필터링
  const filteredData = useMemo(() => {
    return data.filter((item) => enabledSeries.has(item.name));
  }, [data, enabledSeries]);

  // 테마 색상 확장
  const colors = useMemo(() => {
    const baseColors = themeColors?.seriesColors || [];
    return expandSeriesColors(baseColors, allSeriesFields.length);
  }, [themeColors?.seriesColors, allSeriesFields.length]);

  // 시리즈별 색상 조회
  const getColorForSeries = useCallback(
    (seriesName: string) => {
      const idx = allSeriesFields.indexOf(seriesName);
      return idx >= 0 ? colors[idx % colors.length] : colors[0];
    },
    [allSeriesFields, colors]
  );

  // 호버 핸들러
  const onPieEnter = useCallback(
    (_: any, index: number) => {
      setActiveIndex(index);
      const item = filteredData[index];
      if (item && onTooltipChange) {
        onTooltipChange([{ dataKey: item.name, value: item.value, payload: item }], item.name);
      }
    },
    [filteredData, onTooltipChange]
  );

  const onPieLeave = useCallback(() => {
    setActiveIndex(undefined);
    onTooltipChange?.(null, null);
  }, [onTooltipChange]);

  if (filteredData.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <span className="text-muted-foreground text-sm">표시할 시리즈가 없습니다</span>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart margin={{ top: 40, right: 120, bottom: 40, left: 120 }}>
        <Pie
          {...{ activeIndex } as any}
          activeShape={renderActiveShape}
          data={filteredData as any}
          cx="50%"
          cy="50%"
          innerRadius="50%"
          outerRadius="70%"
          dataKey="value"
          nameKey="name"
          onMouseEnter={onPieEnter}
          onMouseLeave={onPieLeave}
        >
          {filteredData.map((entry) => (
            <Cell key={`cell-${entry.name}`} fill={getColorForSeries(entry.name)} />
          ))}
        </Pie>
        <Tooltip content={() => null} />
      </PieChart>
    </ResponsiveContainer>
  );
}
