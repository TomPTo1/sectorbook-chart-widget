"use client";

import React from "react";

interface CustomYAxisLineProps {
  height: number;
  hasBreakTop: boolean;
  hasBreakBottom: boolean;
  strokeColor?: string;
}

/**
 * 커스텀 Y축 선 컴포넌트
 * 영역 경계에서 zigzag 패턴을 포함
 */
export function CustomYAxisLine({
  height,
  hasBreakTop,
  hasBreakBottom,
  strokeColor = "hsl(0 0% 35%)",
}: CustomYAxisLineProps) {
  const zigzagHeight = 12;
  const lineX = 4;
  const zigzagWidth = 4;  // zigzag 좌우 너비

  // 테마별 색상 설정
  const getAxisColor = () => {
    if (strokeColor && strokeColor !== "hsl(var(--border))") {
      return strokeColor;
    }

    const isDark = document.documentElement.classList.contains('dark');

    // 라이트 모드: 레이블보다 조금만 진한 회색
    if (!isDark) {
      return "hsl(0 0% 44%)";
    }

    // 다크 모드: 하얀색
    return "#ffffff";
  };

  const finalStrokeColor = getAxisColor();

  // 직선 시작/끝 위치 계산
  const lineStartY = hasBreakTop ? zigzagHeight : 0;
  const lineEndY = hasBreakBottom ? height - zigzagHeight : height;

  return (
    <svg
      width="12"
      height={height}
      className="absolute left-0 top-0"
      style={{ overflow: "visible" }}
    >
      {/* 상단 zigzag (필요시) */}
      {hasBreakTop && (
        <path
          d={`M${lineX},0 L${lineX - zigzagWidth},${zigzagHeight * 0.25} L${lineX + zigzagWidth},${zigzagHeight * 0.5} L${lineX - zigzagWidth},${zigzagHeight * 0.75} L${lineX},${zigzagHeight}`}
          stroke={finalStrokeColor}
          fill="none"
          strokeWidth="1.5"
        />
      )}

      {/* 직선 부분 */}
      <line
        x1={lineX}
        y1={lineStartY}
        x2={lineX}
        y2={lineEndY}
        stroke={finalStrokeColor}
        strokeWidth="1.5"
      />

      {/* 하단 zigzag (필요시) */}
      {hasBreakBottom && (
        <path
          d={`M${lineX},${height - zigzagHeight} L${lineX - zigzagWidth},${height - zigzagHeight * 0.75} L${lineX + zigzagWidth},${height - zigzagHeight * 0.5} L${lineX - zigzagWidth},${height - zigzagHeight * 0.25} L${lineX},${height}`}
          stroke={finalStrokeColor}
          fill="none"
          strokeWidth="1.5"
        />
      )}
    </svg>
  );
}
