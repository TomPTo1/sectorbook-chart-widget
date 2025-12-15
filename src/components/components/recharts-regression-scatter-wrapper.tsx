"use client";

import { useMemo, useEffect } from "react";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Customized,
} from "recharts";
import type { ChartThemeColors } from "./recharts-wrapper";
import { getAxisLineColor } from "./recharts-wrapper";

interface RegressionStats {
  r2: number;
  slope: number;
  intercept: number;
}

interface RechartsRegressionScatterWrapperProps {
  data: Array<Record<string, string | number | null>>;
  xField: string;
  yField: string;
  themeColors?: ChartThemeColors;
  height?: number;
  onRegressionStats?: (stats: RegressionStats | null) => void;
  onTooltipChange?: (payload: any[] | null, label: string | null) => void;
  onOutlierCount?: (count: number) => void;
}

function calculateLinearRegression(
  points: Array<{ x: number; y: number }>
): RegressionStats | null {
  const n = points.length;
  if (n < 2) return null;

  const sumX = points.reduce((acc, p) => acc + p.x, 0);
  const sumY = points.reduce((acc, p) => acc + p.y, 0);
  const sumXY = points.reduce((acc, p) => acc + p.x * p.y, 0);
  const sumX2 = points.reduce((acc, p) => acc + p.x * p.x, 0);

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  const meanY = sumY / n;
  const ssTotal = points.reduce((acc, p) => acc + (p.y - meanY) ** 2, 0);
  const ssResidual = points.reduce(
    (acc, p) => acc + (p.y - (slope * p.x + intercept)) ** 2,
    0
  );
  const r2 = ssTotal === 0 ? 0 : 1 - ssResidual / ssTotal;

  return { slope, intercept, r2 };
}

export function RechartsRegressionScatterWrapper({
  data,
  xField,
  yField,
  themeColors,
  height = 400,
  onRegressionStats,
  onTooltipChange,
  onOutlierCount,
}: RechartsRegressionScatterWrapperProps) {
  const scatterData = useMemo(() => {
    const points: Array<{ x: number; y: number; dateDisplay: string }> = [];

    data.forEach((row) => {
      const xVal = row[xField];
      const yVal = row[yField];

      if (
        typeof xVal === "number" &&
        !isNaN(xVal) &&
        typeof yVal === "number" &&
        !isNaN(yVal)
      ) {
        points.push({ x: xVal, y: yVal, dateDisplay: String(row.date_display || "") });
      }
    });

    return points;
  }, [data, xField, yField]);

  const regression = useMemo(() => {
    return calculateLinearRegression(scatterData);
  }, [scatterData]);

  useEffect(() => {
    onRegressionStats?.(regression);
  }, [regression, onRegressionStats]);

  // 값을 "nice" 값으로 반올림 (0으로 끝나는 값)
  const roundToNice = (value: number, direction: 'floor' | 'ceil') => {
    const absValue = Math.abs(value);
    let step = 10;
    if (absValue >= 1000) step = 100;
    else if (absValue >= 10) step = 10;
    else step = 1;

    if (direction === 'floor') {
      return Math.floor(value / step) * step;
    }
    return Math.ceil(value / step) * step;
  };

  // 0으로 끝나는 tick 배열 생성
  const generateNiceTicks = (min: number, max: number) => {
    const range = max - min;
    let step = 10;
    if (range >= 500) step = 100;
    else if (range >= 100) step = 20;
    else if (range >= 50) step = 10;
    else step = 10;

    const ticks: number[] = [];
    const start = Math.ceil(min / step) * step;
    for (let v = start; v <= max; v += step) {
      ticks.push(v);
    }
    return ticks;
  };

  const { xDomain, yDomain } = useMemo(() => {
    if (scatterData.length === 0) {
      return { xDomain: [0, 100] as [number, number], yDomain: [0, 100] as [number, number] };
    }

    const xValues = scatterData.map((p) => p.x);
    const yValues = scatterData.map((p) => p.y);

    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);

    const xPadding = (xMax - xMin) * 0.05 || 1;
    const yPadding = (yMax - yMin) * 0.05 || 1;

    return {
      xDomain: [roundToNice(xMin - xPadding, 'floor'), roundToNice(xMax + xPadding, 'ceil')] as [number, number],
      yDomain: [roundToNice(yMin - yPadding, 'floor'), roundToNice(yMax + yPadding, 'ceil')] as [number, number],
    };
  }, [scatterData]);

  const xTicks = useMemo(() => generateNiceTicks(xDomain[0], xDomain[1]), [xDomain]);
  const yTicks = useMemo(() => generateNiceTicks(yDomain[0], yDomain[1]), [yDomain]);

  const regressionLineData = useMemo(() => {
    if (!regression) return null;

    const { slope, intercept } = regression;
    const [x1, x2] = xDomain;
    // 양쪽 Y축에서 약 0.7cm 떨어뜨리기 위해 오프셋 적용
    const xOffset = (x2 - x1) * 0.03;
    const adjustedX1 = x1 + xOffset;
    const adjustedX2 = x2 - xOffset;
    const y1 = slope * adjustedX1 + intercept;
    const y2 = slope * adjustedX2 + intercept;

    return { x1: adjustedX1, y1, x2: adjustedX2, y2 };
  }, [regression, xDomain]);

  const scatterColor = "#8BB77E";
  const outlierColor = "#ef4444";

  // 회귀 잔차 기반 이상치 범위 계산
  const residualOutlierBounds = useMemo(() => {
    if (scatterData.length < 4 || !regression) return null;

    const { slope, intercept } = regression;
    const residuals = scatterData.map(p => p.y - (slope * p.x + intercept));

    const sorted = [...residuals].sort((a, b) => a - b);
    const q1Index = Math.floor(sorted.length * 0.25);
    const q3Index = Math.floor(sorted.length * 0.75);
    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;

    return { lower: q1 - 1.5 * iqr, upper: q3 + 1.5 * iqr };
  }, [scatterData, regression]);

  // 이상치 수 계산 및 콜백 전달
  const outlierCount = useMemo(() => {
    if (!residualOutlierBounds || !regression) return 0;
    return scatterData.filter(p => {
      const residual = p.y - (regression.slope * p.x + regression.intercept);
      return residual < residualOutlierBounds.lower || residual > residualOutlierBounds.upper;
    }).length;
  }, [scatterData, regression, residualOutlierBounds]);

  useEffect(() => {
    onOutlierCount?.(outlierCount);
  }, [outlierCount, onOutlierCount]);

  const formatTick = (value: number) => {
    const rounded = Math.round(value);
    if (Math.abs(rounded) >= 1000000) {
      return `${Math.round(rounded / 1000000)}M`;
    }
    if (Math.abs(rounded) >= 1000) {
      return `${Math.round(rounded / 1000)}K`;
    }
    return rounded.toLocaleString();
  };

  // R² 라벨 위치 계산 (겹침 방지)
  const r2LabelYPercent = useMemo(() => {
    if (!regression) return 0.85;

    const xRange = xDomain[1] - xDomain[0];
    const yRange = yDomain[1] - yDomain[0];

    // 후보 위치들 (우측 상단부터 아래로)
    const positions = [0.9, 0.75, 0.6, 0.45, 0.3, 0.15];

    for (const yPercent of positions) {
      const labelY = yDomain[0] + yRange * yPercent;
      const labelXStart = xDomain[0] + xRange * 0.65;

      // 이 영역에 데이터가 있는지 확인
      const hasDataNearby = scatterData.some(p =>
        p.x > labelXStart &&
        p.y > labelY - yRange * 0.1 &&
        p.y < labelY + yRange * 0.1
      );

      // 회귀선과 겹치는지 확인
      const regressionYAtX = regression.slope * (xDomain[0] + xRange * 0.8) + regression.intercept;
      const overlapsRegression = Math.abs(regressionYAtX - labelY) < yRange * 0.1;

      if (!hasDataNearby && !overlapsRegression) {
        return yPercent;
      }
    }

    return 0.15;
  }, [scatterData, regression, xDomain, yDomain]);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart
        margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
      >
        <CartesianGrid
          stroke="#d1d5db"
          strokeWidth={0.5}
          opacity={0.6}
        />
        <XAxis
          type="number"
          dataKey="x"
          name={xField}
          domain={xDomain}
          ticks={xTicks}
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: getAxisLineColor(), strokeWidth: 1.5 }}
          tickFormatter={formatTick}
        />
        <YAxis
          type="number"
          dataKey="y"
          name={yField}
          domain={yDomain}
          ticks={yTicks}
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: getAxisLineColor(), strokeWidth: 1.5 }}
          tickFormatter={formatTick}
        />
        <Tooltip
          cursor={false}
          content={() => null}
        />
        <Scatter
          data={scatterData}
          fill={scatterColor}
          fillOpacity={0.85}
          stroke="#0D0D0D"
          strokeWidth={1}
          shape={(props: any) => {
            const { cx, cy, payload } = props;

            // 회귀 잔차 기반 이상치 판별
            const residual = regression ? payload.y - (regression.slope * payload.x + regression.intercept) : 0;
            const isOutlier = residualOutlierBounds &&
              (residual < residualOutlierBounds.lower || residual > residualOutlierBounds.upper);

            const pointColor = isOutlier ? outlierColor : scatterColor;

            return (
              <circle
                cx={cx}
                cy={cy}
                r={5}
                fill={pointColor}
                fillOpacity={0.85}
                stroke="#0D0D0D"
                strokeWidth={1}
                onMouseEnter={() => {
                  onTooltipChange?.(
                    [
                      { dataKey: xField, value: payload.x, color: pointColor },
                      { dataKey: yField, value: payload.y, color: pointColor, isOutlier, residual: isOutlier ? residual : null },
                    ],
                    payload.dateDisplay
                  );
                }}
                onMouseLeave={() => {
                  onTooltipChange?.(null, null);
                }}
                style={{ cursor: "pointer" }}
              />
            );
          }}
        />
        {/* 상단 테두리 */}
        <ReferenceLine
          y={yDomain[1]}
          stroke={getAxisLineColor()}
          strokeWidth={1.5}
        />
        {/* 우측 테두리 */}
        <ReferenceLine
          x={xDomain[1]}
          stroke={getAxisLineColor()}
          strokeWidth={1.5}
        />
        {regressionLineData && (
          <ReferenceLine
            segment={[
              { x: regressionLineData.x1, y: regressionLineData.y1 },
              { x: regressionLineData.x2, y: regressionLineData.y2 },
            ]}
            stroke="#374151"
            strokeDasharray="5 5"
            strokeWidth={1.5}
          />
        )}
        {/* R² 라벨 (차트 내부 우측) */}
        {regression && (
          <Customized
            component={(props: any) => {
              const { xAxisMap, yAxisMap } = props;
              const xAxis = xAxisMap?.[0];
              const yAxis = yAxisMap?.[0];
              if (!xAxis || !yAxis) return null;

              const xRange = xDomain[1] - xDomain[0];
              const yRange = yDomain[1] - yDomain[0];
              const labelX = xDomain[0] + xRange * 0.98;
              const labelY = yDomain[0] + yRange * r2LabelYPercent;

              const pixelX = xAxis.scale(labelX);
              const pixelY = yAxis.scale(labelY);

              return (
                <g>
                  <text
                    x={pixelX}
                    y={pixelY}
                    textAnchor="end"
                    fontSize={11}
                    fill="#374151"
                  >
                    <tspan>Regression line (R² = {regression.r2.toFixed(3)})</tspan>
                  </text>
                </g>
              );
            }}
          />
        )}
      </ScatterChart>
    </ResponsiveContainer>
  );
}
