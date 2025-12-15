"use client";

import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
  Cell,
} from "recharts";
import type { ChartThemeColors } from "./recharts-wrapper";

export interface RechartsRankingBarWrapperProps {
  data: Array<Record<string, string | number>>;
  xField: string;
  yField: string;
  themeColors?: ChartThemeColors;
  height?: number;
  onTooltipChange?: (payload: any[] | null, label: string | null) => void;
}

function getAxisLineColor(): string {
  if (typeof window === "undefined") return "hsl(0 0% 44%)";
  const isDark = document.documentElement.classList.contains("dark");
  return isDark ? "#ffffff" : "hsl(0 0% 44%)";
}

function formatValue(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toString();
}

// 랭킹 막대 색상 (1위 → 마지막)
const RANKING_COLOR_START = "#F4A87A";
const RANKING_COLOR_END = "#FADFC7";

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

export function interpolateColor(color1: string, color2: string, factor: number): string {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  const r = Math.round(c1.r + (c2.r - c1.r) * factor);
  const g = Math.round(c1.g + (c2.g - c1.g) * factor);
  const b = Math.round(c1.b + (c2.b - c1.b) * factor);
  return rgbToHex(r, g, b);
}

export function RechartsRankingBarWrapper({
  data,
  xField,
  yField,
  themeColors,
  height = 400,
  onTooltipChange,
}: RechartsRankingBarWrapperProps) {
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      const aValue = typeof a[yField] === "number" ? a[yField] : 0;
      const bValue = typeof b[yField] === "number" ? b[yField] : 0;
      return (bValue as number) - (aValue as number);
    });
  }, [data, yField]);

  // 순위별 색상 계산
  const getBarColor = (index: number): string => {
    if (sortedData.length <= 1) return RANKING_COLOR_START;
    const factor = index / (sortedData.length - 1);
    return interpolateColor(RANKING_COLOR_START, RANKING_COLOR_END, factor);
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={sortedData}
        layout="vertical"
        margin={{ top: 10, right: 80, left: 10, bottom: 10 }}
        onMouseMove={(state: any) => {
          if (state && state.activePayload && state.activePayload.length > 0) {
            const label = state.activeLabel;
            const payload = state.activePayload;
            onTooltipChange?.(payload, label);
          }
        }}
        onMouseLeave={() => {
          onTooltipChange?.(null, null);
        }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={themeColors?.gridColor || "hsl(0 0% 85%)"}
          opacity={0.5}
          horizontal={true}
          vertical={false}
        />
        <XAxis
          type="number"
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: getAxisLineColor(), strokeWidth: 1.5 }}
          tickFormatter={(value) => formatValue(value)}
        />
        <Bar
          dataKey={yField}
          radius={[0, 2, 2, 0]}
        >
          {sortedData.map((_, index) => (
            <Cell key={`cell-${index}`} fill={getBarColor(index)} />
          ))}
          <LabelList
            dataKey={yField}
            position="right"
            fill="hsl(var(--muted-foreground))"
            fontSize={10}
            formatter={((value: number) => formatValue(value)) as any}
          />
        </Bar>
        <YAxis
          type="category"
          dataKey={xField}
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: getAxisLineColor(), strokeWidth: 1.5 }}
          width={100}
          interval={0}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
