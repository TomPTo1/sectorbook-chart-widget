"use client";

import React, { useMemo, useCallback } from "react";
import { Treemap, ResponsiveContainer } from "recharts";
import type { ChartThemeColors } from "./recharts-wrapper";
import { expandSeriesColors } from "./recharts-wrapper";
import type { TreemapDataItem } from "../utils/recharts-adapter";

export interface RechartsTreemapWrapperProps {
  data: TreemapDataItem[];
  enabledSeries: Set<string>;
  themeColors?: ChartThemeColors;
  height?: number;
  allSeriesFields: string[];
  onTooltipChange?: (payload: any[] | null, label: string | null) => void;
}

interface CustomContentProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  depth?: number;
  name?: string;
  index?: number;
  colors: string[];
  allSeriesFields: string[];
  root?: { children?: { length: number } };
  size?: number;
  seriesName?: string;
  onTooltipChange?: (payload: any[] | null, label: string | null) => void;
  filteredData?: TreemapDataItem[];
}

const CustomizedContent: React.FC<CustomContentProps> = (props) => {
  const {
    x = 0, y = 0, width = 0, height = 0, depth = 0,
    name, index = 0, colors, allSeriesFields,
    seriesName, onTooltipChange, filteredData
  } = props;

  // depth=1: 시리즈 노드, depth=2: 값 노드
  const actualSeriesName = depth === 1 ? name : seriesName;
  const seriesIndex = allSeriesFields.indexOf(actualSeriesName || '');
  const colorIndex = seriesIndex >= 0 ? seriesIndex : index;

  const handleMouseEnter = useCallback(() => {
    if (onTooltipChange && filteredData && name) {
      // 동일 날짜(name)의 모든 시리즈 값 찾기
      const allSeriesValues = filteredData.map(series => {
        const child = series.children?.find(c => c.name === name);
        const sIndex = allSeriesFields.indexOf(series.name);
        return {
          dataKey: series.name,
          value: child?.size,
          color: colors[sIndex >= 0 ? sIndex : 0],
          payload: { name, size: child?.size, seriesName: series.name }
        };
      }).filter(item => item.value !== undefined);

      onTooltipChange(allSeriesValues, name);
    }
  }, [onTooltipChange, filteredData, name, allSeriesFields, colors]);

  const handleMouseLeave = useCallback(() => {
    onTooltipChange?.(null, null);
  }, [onTooltipChange]);

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: depth < 2 ? colors[colorIndex % colors.length] : "#ffffff00",
          stroke: "#fff",
          strokeWidth: 2 / (depth + 1e-10),
          strokeOpacity: 1 / (depth + 1e-10),
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />
      {depth === 1 && width > 40 && height > 20 ? (
        <text
          x={x + width / 2}
          y={y + height / 2 + 5}
          textAnchor="middle"
          fill="#fff"
          fontSize={12}
          style={{ pointerEvents: "none" }}
        >
          {name}
        </text>
      ) : null}
    </g>
  );
};

export function RechartsTreemapWrapper({
  data,
  enabledSeries,
  themeColors,
  height = 400,
  allSeriesFields,
  onTooltipChange,
}: RechartsTreemapWrapperProps) {
  const filteredData = useMemo(() => {
    return data.filter((item) => enabledSeries.has(item.name));
  }, [data, enabledSeries]);

  const colors = useMemo(() => {
    const baseColors = themeColors?.seriesColors || [];
    return expandSeriesColors(baseColors, allSeriesFields.length);
  }, [themeColors?.seriesColors, allSeriesFields.length]);

  if (filteredData.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <span className="text-muted-foreground text-sm">표시할 시리즈가 없습니다</span>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <Treemap
        data={filteredData as any}
        dataKey="size"
        stroke="#fff"
        fill="#8884d8"
        isAnimationActive={false}
        content={
          <CustomizedContent
            colors={colors}
            allSeriesFields={allSeriesFields}
            onTooltipChange={onTooltipChange}
            filteredData={filteredData}
          />
        }
      />
    </ResponsiveContainer>
  );
}
