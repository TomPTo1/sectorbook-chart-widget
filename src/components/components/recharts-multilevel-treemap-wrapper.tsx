"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Treemap, ResponsiveContainer } from "recharts";
import type { ChartThemeColors } from "./recharts-wrapper";
import { expandSeriesColors } from "./recharts-wrapper";
import type { MultiLevelTreemapNode } from "../utils/recharts-adapter";

export const MULTI_LEVEL_TREEMAP_COLORS = [
  "#E19379",
  "#E3C0A2",
  "#E0B088",
  "#6D84A0",
  "#999A9C",
  "#D6967E",
];

export interface TreemapSeriesData {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

export interface TreemapStats {
  totalSum: number;
  itemCount: number;
  isDrilledDown: boolean;
  parentName?: string;
  parentColor?: string;
  seriesData?: TreemapSeriesData[];
}

export interface RechartsMultiLevelTreemapWrapperProps {
  data: MultiLevelTreemapNode[];
  enabledSeries: Set<string>;
  themeColors?: ChartThemeColors;
  height?: number;
  allSeriesFields: string[];
  onTooltipChange?: (payload: any[] | null, label: string | null) => void;
  onDrilldownChange?: (stats: TreemapStats | null) => void;
}

interface DrilldownState {
  parentNode: MultiLevelTreemapNode | null;
  currentData: MultiLevelTreemapNode[];
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
  size?: number;
  seriesName?: string;
  children?: MultiLevelTreemapNode[];
  onNodeClick?: (node: { name: string; children?: MultiLevelTreemapNode[]; seriesName?: string }) => void;
  isDrilledDown?: boolean;
  totalSize?: number;
}

const CustomizedContent: React.FC<CustomContentProps> = (props) => {
  const {
    x = 0, y = 0, width = 0, height = 0,
    name, index = 0, colors, allSeriesFields,
    size, seriesName, children, onNodeClick, isDrilledDown, totalSize = 0
  } = props;

  const hasChildren = children && children.length > 0;
  const actualSeriesName = seriesName || name;
  const seriesIndex = allSeriesFields.indexOf(actualSeriesName || '');
  const colorIndex = seriesIndex >= 0 ? seriesIndex : index;

  // 비중 계산
  const percentage = totalSize > 0 ? ((size || 0) / totalSize * 100).toFixed(1) : "0.0";

  const handleClick = useCallback(() => {
    if (onNodeClick) {
      onNodeClick({ name: name || '', children, seriesName });
    }
  }, [onNodeClick, name, children, seriesName]);

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: colors[colorIndex % colors.length],
          stroke: "#fff",
          strokeWidth: 2,
          cursor: hasChildren || isDrilledDown ? "pointer" : "default",
        }}
        onClick={handleClick}
      />
      {width > 40 && height > 20 && (
        <>
          <text
            x={x + 6}
            y={y + 24}
            fill="#444444"
            fontSize={12}
            fontWeight={400}
            style={{ pointerEvents: "none" }}
          >
            {name}
          </text>
          <text
            x={x + 6}
            y={y + 46}
            fill="#444444"
            fontSize={11}
            fontWeight={400}
            style={{ pointerEvents: "none" }}
          >
            {percentage}%
          </text>
        </>
      )}
    </g>
  );
};


const UndoIcon = ({ size = 16, color = 'currentColor', strokeWidth = 2 }: { size?: number; color?: string; strokeWidth?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M9 14L4 9L9 4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 9H14C17.3137 9 20 11.6863 20 15C20 18.3137 17.3137 21 14 21H12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

interface DrilldownHeaderProps {
  parentNode: MultiLevelTreemapNode;
  color: string;
  onBack: () => void;
}

const DrilldownHeader: React.FC<DrilldownHeaderProps> = ({ parentNode, color, onBack }) => {
  return (
    <div className="w-full flex justify-end px-3 py-2">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-gray-600 text-sm font-normal cursor-pointer transition-opacity hover:opacity-70"
      >
        <span className="underline">상위 단계로 이동</span>
        <UndoIcon size={14} />
      </button>
    </div>
  );
};

export function RechartsMultiLevelTreemapWrapper({
  data,
  enabledSeries,
  themeColors,
  height = 400,
  allSeriesFields,
  onTooltipChange,
  onDrilldownChange,
}: RechartsMultiLevelTreemapWrapperProps) {
  const [drilldownState, setDrilldownState] = useState<DrilldownState>({
    parentNode: null,
    currentData: data,
  });

  useEffect(() => {
    setDrilldownState({
      parentNode: null,
      currentData: data,
    });
  }, [data]);

  const isDrilledDown = drilldownState.parentNode !== null;

  // 드릴다운 상태 변경 시 통계 정보 전달
  useEffect(() => {
    if (!onDrilldownChange) return;

    if (isDrilledDown && drilldownState.parentNode) {
      // 드릴다운 상태: 해당 시리즈의 children 통계
      const children = drilldownState.currentData;
      const totalSum = children.reduce((sum, item) => sum + (item.size || 0), 0);
      // 색상 계산
      const colors = expandSeriesColors(MULTI_LEVEL_TREEMAP_COLORS, allSeriesFields.length);
      const seriesIndex = allSeriesFields.indexOf(drilldownState.parentNode.seriesName || drilldownState.parentNode.name);
      const color = colors[seriesIndex >= 0 ? seriesIndex : 0] || colors[0];
      onDrilldownChange({
        totalSum,
        itemCount: children.length,
        isDrilledDown: true,
        parentName: drilldownState.parentNode.name,
        parentColor: color,
      });
    } else {
      // 첫 화면: 전체 시리즈 통계
      const enabledData = data.filter(item => enabledSeries.has(item.seriesName || item.name));
      const colors = expandSeriesColors(MULTI_LEVEL_TREEMAP_COLORS, allSeriesFields.length);

      // 시리즈별 합계 계산
      const seriesData: TreemapSeriesData[] = enabledData.map(item => {
        const seriesIndex = allSeriesFields.indexOf(item.seriesName || item.name);
        const value = item.children?.reduce((s, c) => s + (c.size || 0), 0) || 0;
        return {
          name: item.name,
          value,
          percentage: 0,
          color: colors[seriesIndex >= 0 ? seriesIndex : 0] || colors[0],
        };
      });

      const totalSum = seriesData.reduce((sum, s) => sum + s.value, 0);

      // 비중 계산
      seriesData.forEach(s => {
        s.percentage = totalSum > 0 ? (s.value / totalSum) * 100 : 0;
      });

      onDrilldownChange({
        totalSum,
        itemCount: enabledData.length,
        isDrilledDown: false,
        seriesData,
      });
    }
  }, [isDrilledDown, drilldownState.parentNode, drilldownState.currentData, data, enabledSeries, onDrilldownChange, allSeriesFields]);

  // 첫 화면용 데이터: 시리즈별 총합만 표시 (children 없이)
  const topLevelData = useMemo(() => {
    return data.map(item => {
      const totalSize = item.children?.reduce((sum, child) => sum + (child.size || 0), 0) || 0;
      return {
        name: item.name,
        size: totalSize,
        seriesName: item.seriesName || item.name,
      };
    });
  }, [data]);

  const filteredData = useMemo(() => {
    if (isDrilledDown) {
      // 드릴다운 상태: 해당 시리즈의 children 표시
      return drilldownState.currentData;
    }
    // 첫 화면: 시리즈별 총합만 표시
    return topLevelData.filter((item) =>
      enabledSeries.has(item.seriesName || item.name)
    );
  }, [topLevelData, drilldownState.currentData, enabledSeries, isDrilledDown]);

  // 비중 계산을 위한 전체 합계
  const totalSize = useMemo(() => {
    return filteredData.reduce((sum, item) => sum + (item.size || 0), 0);
  }, [filteredData]);

  const colors = useMemo(() => {
    return expandSeriesColors(MULTI_LEVEL_TREEMAP_COLORS, allSeriesFields.length);
  }, [allSeriesFields.length]);

  const parentColor = useMemo(() => {
    if (!drilldownState.parentNode) return "";
    const seriesIndex = allSeriesFields.indexOf(drilldownState.parentNode.seriesName || drilldownState.parentNode.name);
    return colors[seriesIndex >= 0 ? seriesIndex : 0] || colors[0];
  }, [drilldownState.parentNode, allSeriesFields, colors]);

  const handleNodeClick = useCallback((clickedNode: { name: string; children?: MultiLevelTreemapNode[]; seriesName?: string }) => {
    if (isDrilledDown) {
      // 드릴다운 상태에서 클릭 시 상위로 복귀
      setDrilldownState({
        parentNode: null,
        currentData: data,
      });
      return;
    }

    // 원본 data에서 해당 시리즈 찾기
    const targetNode = data.find((node) => node.name === clickedNode.name);

    if (targetNode?.children && targetNode.children.length > 0) {
      setDrilldownState({
        parentNode: targetNode,
        currentData: targetNode.children,
      });
    }
  }, [isDrilledDown, data]);

  const handleBack = useCallback(() => {
    setDrilldownState({
      parentNode: null,
      currentData: data,
    });
  }, [data]);

  if (filteredData.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <span className="text-muted-foreground text-sm">표시할 시리즈가 없습니다</span>
      </div>
    );
  }

  const headerHeight = isDrilledDown ? 36 : 0;
  const chartHeight = height - headerHeight;

  return (
    <div style={{ height }}>
      {isDrilledDown && drilldownState.parentNode && (
        <DrilldownHeader
          parentNode={drilldownState.parentNode}
          color={parentColor}
          onBack={handleBack}
        />
      )}

      <ResponsiveContainer width="100%" height={chartHeight}>
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
              onNodeClick={handleNodeClick}
              isDrilledDown={isDrilledDown}
              totalSize={totalSize}
            />
          }
        />
      </ResponsiveContainer>
    </div>
  );
}
