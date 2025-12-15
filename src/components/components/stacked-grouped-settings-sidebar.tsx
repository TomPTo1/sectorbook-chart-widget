"use client";

import { Button } from "../ui/button";
import { useState, useEffect } from "react";
import { getButtonBorderColor } from "./recharts-wrapper";

interface StackedGroupedSettingsSidebarProps {
  open: boolean;
  seriesFields: string[];
  seriesColors: string[];
  groupCount: number;
  seriesGroupAssignments: Record<string, number>;
  onGroupCountChange: (count: number) => void;
  onSeriesGroupChange: (field: string, group: number) => void;
}

export function StackedGroupedSettingsSidebar({
  open,
  seriesFields,
  seriesColors,
  groupCount,
  seriesGroupAssignments,
  onGroupCountChange,
  onSeriesGroupChange,
}: StackedGroupedSettingsSidebarProps) {
  const [borderColor, setBorderColor] = useState<string>("hsl(0 0% 66%)");

  useEffect(() => {
    const updateColor = () => setBorderColor(getButtonBorderColor());
    updateColor();

    const observer = new MutationObserver(updateColor);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  if (!open) return null;

  return (
    <div className="w-[220px] border-l bg-card/50 flex flex-col flex-shrink-0">
      {/* 헤더 */}
      <div className="flex items-start px-4 pt-[22px] pb-3">
        <h3 className="text-xs font-medium text-muted-foreground">시리즈별 그룹 설정</h3>
      </div>

      {/* 그룹 개수 선택 */}
      <div className="px-4 pb-3 space-y-2">
        <span className="text-xs text-muted-foreground">그룹 개수</span>
        <div className="flex gap-1 w-full">
          {[2, 3, 4].map((count) => (
            <Button
              key={count}
              variant="outline"
              size="sm"
              className="flex-1 text-xs h-6 px-2 border-0"
              style={{ border: `1.5px solid ${groupCount === count ? borderColor : "transparent"}` }}
              onClick={() => onGroupCountChange(count)}
            >
              {count}
            </Button>
          ))}
        </div>
      </div>

      {/* 시리즈 목록 */}
      <div className="flex-1 overflow-y-auto pl-4 pr-2 pb-4 space-y-1">
        {seriesFields.map((field, idx) => {
          const color = seriesColors[idx % seriesColors.length];
          const currentGroup = seriesGroupAssignments[field] ?? 1;

          return (
            <div key={field}>
              <div className="py-2.5 space-y-2">
                {/* 마커 + 시리즈명 */}
                <div className="flex items-center gap-2">
                  <div
                    style={{
                      width: '12px',
                      height: '8px',
                      backgroundColor: color,
                      borderRadius: '2px',
                      flexShrink: 0,
                    }}
                  />
                  <span className="text-xs font-medium text-muted-foreground truncate">
                    {field}
                  </span>
                </div>

                {/* 그룹 선택 버튼 */}
                <div className="flex gap-1 w-full">
                  {Array.from({ length: groupCount }, (_, i) => i + 1).map((group) => (
                    <Button
                      key={group}
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs h-6 px-2 border-0"
                      style={{ border: `1.5px solid ${currentGroup === group ? borderColor : "transparent"}` }}
                      onClick={() => onSeriesGroupChange(field, group)}
                    >
                      {group}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs h-6 px-2 border-0"
                    style={{ border: `1.5px solid ${currentGroup === 0 ? borderColor : "transparent"}` }}
                    onClick={() => onSeriesGroupChange(field, 0)}
                  >
                    숨김
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
