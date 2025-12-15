"use client";

import { Button } from "../ui/button";
import { cn } from "../../utils/cn";
import { useState, useEffect } from "react";
import { getButtonBorderColor } from "./recharts-wrapper";
import type { YAxisPlacement } from "../../types/chart-config";

interface ChartSettingsSidebarProps {
  open: boolean;
  seriesFields: string[];
  seriesColors: string[];
  getCurrentTypeForField: (field: string) => "line" | "column" | "none";
  onTypeChange: (field: string, type: "column" | "line" | "none") => void;
  chartType?: "line" | "column" | "mixed" | "stacked" | "stacked-100" | "stacked-grouped" | "dual-axis" | "pie" | "two-level-pie" | "treemap" | "ranking-bar";
  yAxisPlacements?: Record<string, YAxisPlacement>;
  onAxisPlacementChange?: (field: string, placement: YAxisPlacement) => void;
}

export function ChartSettingsSidebar({
  open,
  seriesFields,
  seriesColors,
  getCurrentTypeForField,
  onTypeChange,
  chartType,
  yAxisPlacements,
  onAxisPlacementChange,
}: ChartSettingsSidebarProps) {
  // Y축 색상 동기화
  const [borderColor, setBorderColor] = useState<string>("hsl(0 0% 66%)");

  useEffect(() => {
    const updateColor = () => setBorderColor(getButtonBorderColor());
    updateColor();

    // 다크모드 전환 감지
    const observer = new MutationObserver(updateColor);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="w-[220px] border-l bg-card/50 flex flex-col flex-shrink-0">
      {/* 헤더 */}
      <div className="flex items-start px-4 pt-[22px] pb-3">
        <h3 className="text-xs font-medium text-muted-foreground">시리즈별 타입 설정</h3>
      </div>

      {/* 시리즈 목록 */}
      <div className="flex-1 overflow-y-auto pl-4 pr-2 pb-4 space-y-1">
        {seriesFields.map((field, idx) => {
          const currentType = getCurrentTypeForField(field);
          const color = seriesColors[idx % seriesColors.length];

          return (
            <div key={field}>
              <div className="py-2.5 space-y-2">
                {/* 마커 + 시리즈명 */}
                <div className="flex items-center gap-2">
                  <div
                    style={{
                      width: '12px',
                      height: currentType === 'line' ? '3px' : '8px',
                      backgroundColor: color,
                      borderRadius: currentType === 'column' ? '2px' : '0',
                      flexShrink: 0,
                    }}
                  />
                  <span className="text-xs font-medium text-muted-foreground truncate">
                    {field}
                  </span>
                </div>

                {/* 버튼 그룹 */}
                <div className="flex gap-1 w-full">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs h-6 px-2 border-0"
                    style={{ border: `1.5px solid ${currentType === "line" ? borderColor : "transparent"}` }}
                    onClick={() => onTypeChange(field, "line")}
                  >
                    라인
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs h-6 px-2 border-0"
                    style={{ border: `1.5px solid ${currentType === "column" ? borderColor : "transparent"}` }}
                    onClick={() => onTypeChange(field, "column")}
                  >
                    막대
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs h-6 px-2 border-0"
                    style={{ border: `1.5px solid ${currentType === "none" ? borderColor : "transparent"}` }}
                    onClick={() => onTypeChange(field, "none")}
                  >
                    숨김
                  </Button>
                </div>

                {/* 좌/우 배치 버튼 - 이중축일 때만 표시 */}
                {chartType === 'dual-axis' && onAxisPlacementChange && yAxisPlacements && (
                  <div className="flex gap-1 w-full mt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs h-6 px-2 border-0"
                      style={{ border: `1.5px solid ${yAxisPlacements[field] === "left" ? borderColor : "transparent"}` }}
                      onClick={() => onAxisPlacementChange(field, "left")}
                    >
                      좌측 (좌)
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs h-6 px-2 border-0"
                      style={{ border: `1.5px solid ${yAxisPlacements[field] === "right" ? borderColor : "transparent"}` }}
                      onClick={() => onAxisPlacementChange(field, "right")}
                    >
                      우측 (우)
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
