"use client";

import { useState } from "react";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, AlertTriangle, CircleDot, CheckSquare, Square } from "lucide-react";
import { LegendItem } from "./legend-item";
import { ChartSettingsSidebar } from "./chart-settings-sidebar";
import { StackedGroupedSettingsSidebar } from "./stacked-grouped-settings-sidebar";
import type { ChartType, ExtendedDataAnalysisResult, LegendValueState, YAxisPlacement } from "../../types/chart-config";
import { CHART_TYPE_TO_NAME } from "../../types/chart-config";
import { cn } from "../../utils/cn";
import { interpolateColor, getButtonBorderColor } from "./recharts-wrapper";

interface TreemapSeriesData {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

interface TreemapStats {
  totalSum: number;
  itemCount: number;
  isDrilledDown: boolean;
  parentName?: string;
  parentColor?: string;
  seriesData?: TreemapSeriesData[];
}

interface ChartLegendPanelProps {
  seriesFields: string[];
  seriesColors: string[];
  enabledSeries: Set<string>;
  tooltipPayload: any[] | null;
  hoveredLabel: string | null;
  analysisResult: ExtendedDataAnalysisResult | null;
  rankingData?: Array<{ name: string; value: number }> | null;
  onSeriesToggle: (field: string) => void;
  onToggleAll: (enable: boolean) => void;
  collapseThreshold?: number;
  title?: string;
  description?: string;
  chartType?: ChartType;
  yFieldTypes?: Record<string, "column" | "line">;
  yAxisPlacements?: Record<string, YAxisPlacement>;
  onYFieldTypeChange?: (field: string, type: "column" | "line" | "none") => void;
  onYAxisPlacementChange?: (field: string, placement: YAxisPlacement) => void;
  // 그룹형 누적막대 관련
  groupCount?: number;
  seriesGroupAssignments?: Record<string, number>;
  onGroupCountChange?: (count: number) => void;
  onSeriesGroupChange?: (field: string, group: number) => void;
  // 동기화 영역 차트 관련
  syncedAreaLeftField?: string;
  syncedAreaRightField?: string;
  onSyncedAreaFieldChange?: (position: 'left' | 'right', field: string) => void;
  // 멀티레벨 트리맵 통계
  treemapStats?: TreemapStats | null;
  // 회귀 산점도 관련
  regressionScatterXField?: string;
  regressionScatterYField?: string;
  onRegressionScatterFieldChange?: (axis: 'x' | 'y', field: string) => void;
  regressionStats?: { r2: number } | null;
  // 레이아웃: bottom (하단), vertical (우측), sidePanel (우측 사이드패널 - 화면 전환 방식)
  layout?: 'bottom' | 'vertical' | 'sidePanel';
  // 차트 제어판 (sidePanel 레이아웃에서 사용)
  allowedChartTypes?: ChartType[];
  onChartTypeChange?: (type: ChartType) => void;
  showOutliers?: boolean;
  showMissingValues?: boolean;
  onShowOutliersChange?: (show: boolean) => void;
  onShowMissingValuesChange?: (show: boolean) => void;
  supportsOutliers?: boolean;
  supportsMissing?: boolean;
}

// 값 포맷 함수
function formatValue(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

// 랭킹 막대 색상 상수
const RANKING_COLOR_START = "#F4A87A";
const RANKING_COLOR_END = "#FADFC7";

export function ChartLegendPanel({
  seriesFields,
  seriesColors,
  enabledSeries,
  tooltipPayload,
  hoveredLabel,
  analysisResult,
  rankingData,
  onSeriesToggle,
  onToggleAll,
  collapseThreshold = 6,
  title,
  description,
  chartType,
  yFieldTypes,
  yAxisPlacements,
  onYFieldTypeChange,
  onYAxisPlacementChange,
  groupCount,
  seriesGroupAssignments,
  onGroupCountChange,
  onSeriesGroupChange,
  syncedAreaLeftField,
  syncedAreaRightField,
  onSyncedAreaFieldChange,
  treemapStats,
  regressionScatterXField,
  regressionScatterYField,
  onRegressionScatterFieldChange,
  regressionStats,
  layout = 'bottom',
  // 차트 제어판 props
  allowedChartTypes,
  onChartTypeChange,
  showOutliers,
  showMissingValues,
  onShowOutliersChange,
  onShowMissingValuesChange,
  supportsOutliers,
  supportsMissing,
}: ChartLegendPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [viewMode, setViewMode] = useState<'legend' | 'settings'>('legend');
  const isBottom = layout === 'bottom';
  const isSidePanel = layout === 'sidePanel';

  // 특정 시리즈의 현재 타입 결정
  const getCurrentTypeForField = (field: string): "line" | "column" | "none" => {
    if (!enabledSeries.has(field)) return "none";
    if ((chartType === "mixed" || chartType === "dual-axis") && yFieldTypes?.[field]) {
      return yFieldTypes[field];
    }
    return chartType === "column" || chartType === "stacked" || chartType === "stacked-100" ? "column" : "line";
  };

  // 값 조회 (이상치 여부 포함)
  const getSeriesValueWithState = (seriesName: string): { value: number | null; isOutlier: boolean } => {
    if (!tooltipPayload) return { value: null, isOutlier: false };

    // 1. 이상치 키 매칭 먼저 시도 (우선순위)
    const outlierMatch = tooltipPayload.find((p: any) => {
      if (typeof p.dataKey === 'string' && p.dataKey.startsWith('outlier_')) {
        const payload = p.payload;
        const fieldKey = `${p.dataKey}_field`;
        return payload && payload[fieldKey] === seriesName;
      }
      return false;
    });

    if (outlierMatch) return { value: outlierMatch.value ?? null, isOutlier: true };

    // 2. 직접 매칭 시도 (정상 데이터)
    const directMatch = tooltipPayload.find((p: any) => p.dataKey === seriesName);
    if (directMatch) return { value: directMatch.value ?? null, isOutlier: false };

    // 3. 분리된 필드 매칭 시도 (_positive, _negative)
    const positiveMatch = tooltipPayload.find((p: any) => p.dataKey === `${seriesName}_positive`);
    const negativeMatch = tooltipPayload.find((p: any) => p.dataKey === `${seriesName}_negative`);

    // 분리된 필드가 있으면 둘 중 null이 아닌 값 반환
    if (positiveMatch && positiveMatch.value != null) {
      return { value: positiveMatch.value, isOutlier: false };
    }
    if (negativeMatch && negativeMatch.value != null) {
      return { value: negativeMatch.value, isOutlier: false };
    }

    return { value: null, isOutlier: false };
  };

  // 값만 조회 (호환성 유지)
  const getSeriesValue = (seriesName: string): number | null => {
    return getSeriesValueWithState(seriesName).value;
  };

  // 100% 누적막대에서 원본값 조회
  const getOriginalValue = (seriesName: string): number | null => {
    if (!tooltipPayload || chartType !== "stacked-100") return null;

    const originalMatch = tooltipPayload.find((p: any) => {
      if (p.payload && typeof p.payload[`${seriesName}_original`] === "number") {
        return true;
      }
      return false;
    });

    if (originalMatch) {
      return originalMatch.payload[`${seriesName}_original`] ?? null;
    }
    return null;
  };

  // 값 상태 결정
  const getValueState = (seriesName: string): LegendValueState => {
    const { value, isOutlier } = getSeriesValueWithState(seriesName);
    if (value === null) return 'missing';
    if (isOutlier) return 'outlier';
    return 'normal';
  };

  // 전체 선택 여부
  const allEnabled = enabledSeries.size === seriesFields.length;

  // 표시할 시리즈
  const displayedSeries = isExpanded || seriesFields.length <= collapseThreshold
    ? seriesFields
    : seriesFields.slice(0, collapseThreshold);

  // 시리즈 설정이 필요한 차트 타입인지 확인
  const needsSettings =
    ((chartType === 'mixed' || chartType === 'dual-axis') && onYFieldTypeChange) ||
    (chartType === 'stacked-grouped' && onGroupCountChange && onSeriesGroupChange);

  // 사이드패널 레이아웃 (화면 전환 방식)
  if (isSidePanel) {
    // 특수 차트 타입 체크 (레전드 토글 불필요)
    const isSpecialChart = chartType === "ranking-bar" || chartType === "geo-grid" ||
                           chartType === "multi-level-treemap" || chartType === "regression-scatter";

    return (
      <div className="h-full flex flex-col">
        {/* 헤더 - settings 모드일 때만 표시 */}
        {viewMode === 'settings' && (
          <div className="flex items-center gap-2 px-4 py-3 border-b flex-shrink-0">
            <button
              onClick={() => setViewMode('legend')}
              className="p-1 hover:bg-gray-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium">
              {chartType === 'stacked-grouped' ? '그룹 설정' : '시리즈 설정'}
            </span>
          </div>
        )}

        {/* 차트 제어판 (한 줄: 차트유형 + 이상치/결측치/전체선택 아이콘) - legend 모드일 때만 */}
        {viewMode === 'legend' && (
          <div className="px-3 py-2 border-b flex-shrink-0 flex items-center gap-2">
            {/* 차트 유형 드롭다운 */}
            {allowedChartTypes && allowedChartTypes.length > 1 && (
              <Select value={chartType} onValueChange={(value) => onChartTypeChange?.(value as ChartType)}>
                <SelectTrigger
                  className="h-7 flex-1 text-xs rounded-none"
                  style={{ border: '1px solid rgba(0, 0, 0, 0.06)' }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allowedChartTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {CHART_TYPE_TO_NAME[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* 우측 아이콘 버튼들 */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* 이상치 토글 */}
              <button
                className="h-7 w-7 flex items-center justify-center transition-all disabled:opacity-50"
                style={showOutliers ? {
                  background: 'linear-gradient(135deg, #555 0%, #333 100%)',
                  color: 'white',
                } : {
                  background: 'white',
                  border: '1px solid rgba(0, 0, 0, 0.06)',
                  color: '#666',
                }}
                onClick={() => onShowOutliersChange?.(!showOutliers)}
                disabled={!supportsOutliers}
                title="이상치 표시"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
              </button>
              {/* 결측치 토글 */}
              <button
                className="h-7 w-7 flex items-center justify-center transition-all disabled:opacity-50"
                style={showMissingValues ? {
                  background: 'linear-gradient(135deg, #555 0%, #333 100%)',
                  color: 'white',
                } : {
                  background: 'white',
                  border: '1px solid rgba(0, 0, 0, 0.06)',
                  color: '#666',
                }}
                onClick={() => onShowMissingValuesChange?.(!showMissingValues)}
                disabled={!supportsMissing}
                title="결측치 표시"
              >
                <CircleDot className="h-3.5 w-3.5" />
              </button>
              {/* 전체 선택/해제 */}
              {!isSpecialChart && seriesFields.length > 0 && (
                <button
                  className="h-7 w-7 flex items-center justify-center transition-all"
                  style={allEnabled ? {
                    background: 'linear-gradient(135deg, #555 0%, #333 100%)',
                    color: 'white',
                  } : {
                    background: 'white',
                    border: '1px solid rgba(0, 0, 0, 0.06)',
                    color: '#666',
                  }}
                  onClick={() => onToggleAll(!allEnabled)}
                  title={allEnabled ? "전체 해제" : "전체 선택"}
                >
                  {allEnabled ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                </button>
              )}
            </div>
          </div>
        )}

        {/* 메인 콘텐츠 */}
        <div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          {viewMode === 'legend' ? (
            // 레전드 목록
            <div className="p-4">
              {/* 동기화 영역 차트 시리즈 선택 */}
              {chartType === 'synced-area' && onSyncedAreaFieldChange && (
                <div className="mb-4 space-y-2">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">좌측 차트</label>
                    <Select value={syncedAreaLeftField || ""} onValueChange={(value) => onSyncedAreaFieldChange('left', value)}>
                      <SelectTrigger className="w-full h-8 text-xs">
                        <SelectValue placeholder="시리즈 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {seriesFields.map((field) => (
                          <SelectItem key={field} value={field}>
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: seriesColors[seriesFields.indexOf(field) % seriesColors.length] }}
                              />
                              {field}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">우측 차트</label>
                    <Select value={syncedAreaRightField || ""} onValueChange={(value) => onSyncedAreaFieldChange('right', value)}>
                      <SelectTrigger className="w-full h-8 text-xs">
                        <SelectValue placeholder="시리즈 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {seriesFields.map((field) => (
                          <SelectItem key={field} value={field}>
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: seriesColors[seriesFields.indexOf(field) % seriesColors.length] }}
                              />
                              {field}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* 회귀 산점도 시리즈 선택 */}
              {chartType === 'regression-scatter' && onRegressionScatterFieldChange && (
                <div className="mb-4 space-y-2">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">X축</label>
                    <Select value={regressionScatterXField || ""} onValueChange={(value) => onRegressionScatterFieldChange('x', value)}>
                      <SelectTrigger className="w-full h-8 text-xs">
                        <SelectValue placeholder="시리즈 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {seriesFields.map((field) => (
                          <SelectItem key={field} value={field}>
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: seriesColors[seriesFields.indexOf(field) % seriesColors.length] }}
                              />
                              {field}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Y축</label>
                    <Select value={regressionScatterYField || ""} onValueChange={(value) => onRegressionScatterFieldChange('y', value)}>
                      <SelectTrigger className="w-full h-8 text-xs">
                        <SelectValue placeholder="시리즈 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {seriesFields.map((field) => (
                          <SelectItem key={field} value={field}>
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: seriesColors[seriesFields.indexOf(field) % seriesColors.length] }}
                              />
                              {field}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {regressionStats && (
                    <div className="text-xs text-muted-foreground">R² = {regressionStats.r2.toFixed(4)}</div>
                  )}
                </div>
              )}

              {/* X축 레이블 */}
              <div className="text-xs font-medium text-muted-foreground mb-3">
                {chartType === "ranking-bar"
                  ? (hoveredLabel ? "선택된 항목" : <span className="italic">차트를 가리켜보세요</span>)
                  : chartType === "geo-grid"
                  ? (hoveredLabel || <span className="italic">지역을 가리켜보세요</span>)
                  : chartType === "multi-level-treemap"
                  ? (treemapStats?.isDrilledDown
                      ? <span className="italic">클릭하여 상위로 이동</span>
                      : <span className="italic">시리즈를 클릭하여 상세 보기</span>)
                  : chartType === "regression-scatter"
                  ? (hoveredLabel || <span className="italic">포인트를 가리켜보세요</span>)
                  : (hoveredLabel || <span className="italic">차트를 가리켜보세요</span>)
                }
              </div>

              {/* 레전드 아이템들 */}
              <div className="space-y-1">
                {chartType === "ranking-bar" && rankingData ? (
                  // 랭킹막대 전용 레전드
                  (() => {
                    const hoveredItem = rankingData.find(item => item.name === hoveredLabel);
                    const hoveredIndex = rankingData.findIndex(item => item.name === hoveredLabel);
                    return (
                      <div className="rounded-lg bg-gray-100 px-3 py-3 min-h-[60px] flex flex-col justify-center">
                        {hoveredItem ? (
                          <>
                            <div className="text-sm font-semibold text-gray-700">{hoveredItem.name}</div>
                            <div className="w-full h-px bg-gray-300 my-2"></div>
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: interpolateColor(RANKING_COLOR_START, RANKING_COLOR_END, hoveredIndex / Math.max(1, rankingData.length - 1)) }}
                              />
                              <span className="text-xs font-medium text-gray-700">{formatValue(hoveredItem.value)}</span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">순위: {hoveredIndex + 1}위</div>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400 italic">차트를 가리켜보세요</span>
                        )}
                      </div>
                    );
                  })()
                ) : chartType === "geo-grid" ? (
                  // 지도그리드 전용 레전드
                  <div className="rounded-lg bg-gray-100 px-3 py-3 min-h-[60px] flex flex-col justify-center">
                    {hoveredLabel && tooltipPayload && tooltipPayload[0] ? (
                      <>
                        <div className="text-sm font-semibold text-gray-700">{hoveredLabel}</div>
                        <div className="w-full h-px my-2 bg-gray-300"></div>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tooltipPayload[0].color || "#388F76" }} />
                          {hoveredLabel === "한강" ? (
                            <span className="text-xs font-medium text-gray-700">
                              데이터는 없지만 분위기는 있습니다
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-gray-700">
                              {formatValue(tooltipPayload[0].value)}
                              {tooltipPayload[0].totalSum && (
                                <span className="ml-1">
                                  (전체 합계의 {((tooltipPayload[0].value / tooltipPayload[0].totalSum) * 100).toFixed(0)}%)
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-gray-400 italic">지역을 가리켜보세요</span>
                    )}
                  </div>
                ) : chartType === "multi-level-treemap" && treemapStats ? (
                  // 멀티레벨 트리맵 전용 레전드
                  <div className="rounded-lg bg-gray-100 px-3 py-3 min-h-[60px] flex flex-col justify-center">
                    {treemapStats.isDrilledDown ? (
                      <>
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                          {treemapStats.parentColor && (
                            <span
                              className="w-2 h-2 flex-shrink-0"
                              style={{ backgroundColor: treemapStats.parentColor }}
                            />
                          )}
                          {treemapStats.parentName}
                        </div>
                        <div className="w-full h-px my-2 bg-gray-300"></div>
                        <div className="text-xs text-gray-600 space-y-1">
                          <div>합계: {formatValue(treemapStats.totalSum)}</div>
                          <div>항목 수: {treemapStats.itemCount}개</div>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-2">
                        {treemapStats.seriesData?.map((series) => (
                          <div key={series.name} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2 h-2 flex-shrink-0"
                                style={{ backgroundColor: series.color }}
                              />
                              <span className="text-xs text-gray-700">{series.name}</span>
                            </div>
                            <div className="text-xs text-gray-600">
                              {formatValue(series.value)} ({series.percentage.toFixed(1)}%)
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : chartType === "regression-scatter" ? (
                  // 회귀 산점도 전용 레전드
                  <div className="rounded-lg bg-gray-100 px-3 py-3 min-h-[60px] flex flex-col justify-center">
                    {tooltipPayload && tooltipPayload.length >= 2 ? (
                      <>
                        <div className="text-sm font-semibold text-gray-700 mb-2">{hoveredLabel || "선택된 포인트"}</div>
                        <div className="w-full h-px bg-gray-300 mb-2"></div>
                        <div className="space-y-1.5">
                          {tooltipPayload.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <span className="text-xs text-gray-700">{item.dataKey}({idx === 0 ? 'X' : 'Y'}):</span>
                              <span className="text-xs font-medium text-gray-700">
                                {formatValue(item.value)}
                              </span>
                            </div>
                          ))}
                          {tooltipPayload[1]?.isOutlier && tooltipPayload[1]?.residual != null && (
                            <>
                              <div className="flex items-center gap-2 pt-1">
                                <span className="text-xs text-gray-700">상태:</span>
                                <span className="text-xs font-medium">
                                  <span className="text-red-500">이상치</span>
                                  <span className="text-gray-700"> (회귀 잔차 {tooltipPayload[1].residual >= 0 ? '+' : ''}{formatValue(tooltipPayload[1].residual)})</span>
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-gray-400 italic">포인트를 가리켜보세요</span>
                    )}
                  </div>
                ) : (
                  // 기본 레전드 (LegendItem 사용)
                  displayedSeries.map((field) => (
                    <LegendItem
                      key={field}
                      name={field}
                      color={seriesColors[seriesFields.indexOf(field) % seriesColors.length]}
                      enabled={enabledSeries.has(field)}
                      value={getSeriesValue(field)}
                      originalValue={getOriginalValue(field)}
                      valueState={getValueState(field)}
                      onClick={() => onSeriesToggle(field)}
                      chartType={chartType}
                      yFieldTypes={yFieldTypes}
                      yAxisPlacement={chartType === 'dual-axis' && yAxisPlacements ? yAxisPlacements[field] : undefined}
                    />
                  ))
                )}
              </div>

              {/* 펼치기/접기 (일반 레전드에서만) */}
              {!isSpecialChart && seriesFields.length > collapseThreshold && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-xs border-dashed mt-2"
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="w-3 h-3 mr-1" />
                      접기
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3 h-3 mr-1" />
                      +{seriesFields.length - collapseThreshold}개
                    </>
                  )}
                </Button>
              )}
            </div>
          ) : (
            // 시리즈 설정 UI
            <div className="p-4">
              {(chartType === 'mixed' || chartType === 'dual-axis') && onYFieldTypeChange && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground mb-3">
                    각 시리즈의 차트 유형을 설정하세요
                  </p>
                  {seriesFields.map((field, idx) => {
                    const currentType = getCurrentTypeForField(field);
                    const color = seriesColors[idx % seriesColors.length];
                    return (
                      <div key={field} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                          <span className="text-xs text-foreground flex-1 truncate">{field}</span>
                        </div>
                        <div className="flex gap-1 pl-5">
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "h-7 px-3 text-xs flex-1",
                              currentType === "line" && "bg-accent border-accent-foreground/20"
                            )}
                            style={currentType === "line" ? { borderColor: getButtonBorderColor(color) } : undefined}
                            onClick={() => onYFieldTypeChange(field, "line")}
                          >
                            라인
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "h-7 px-3 text-xs flex-1",
                              currentType === "column" && "bg-accent border-accent-foreground/20"
                            )}
                            style={currentType === "column" ? { borderColor: getButtonBorderColor(color) } : undefined}
                            onClick={() => onYFieldTypeChange(field, "column")}
                          >
                            막대
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "h-7 px-3 text-xs flex-1",
                              currentType === "none" && "bg-accent border-accent-foreground/20"
                            )}
                            onClick={() => onYFieldTypeChange(field, "none")}
                          >
                            숨김
                          </Button>
                        </div>
                        {/* 이중축 좌/우 설정 */}
                        {chartType === 'dual-axis' && onYAxisPlacementChange && currentType !== "none" && (
                          <div className="flex gap-1 pl-5">
                            <Button
                              variant="outline"
                              size="sm"
                              className={cn(
                                "h-6 px-3 text-xs flex-1",
                                yAxisPlacements?.[field] === "left" && "bg-accent"
                              )}
                              onClick={() => onYAxisPlacementChange(field, "left")}
                            >
                              좌측 축
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className={cn(
                                "h-6 px-3 text-xs flex-1",
                                yAxisPlacements?.[field] === "right" && "bg-accent"
                              )}
                              onClick={() => onYAxisPlacementChange(field, "right")}
                            >
                              우측 축
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {chartType === 'stacked-grouped' && onGroupCountChange && onSeriesGroupChange && (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">그룹 개수</p>
                    <div className="flex gap-1">
                      {[2, 3, 4].map((count) => (
                        <Button
                          key={count}
                          variant="outline"
                          size="sm"
                          className={cn(
                            "h-7 px-4 text-xs flex-1",
                            groupCount === count && "bg-accent"
                          )}
                          onClick={() => onGroupCountChange(count)}
                        >
                          {count}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">시리즈별 그룹 배정</p>
                    {seriesFields.map((field, idx) => {
                      const currentGroup = seriesGroupAssignments?.[field] ?? 1;
                      const color = seriesColors[idx % seriesColors.length];
                      return (
                        <div key={field} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                            <span className="text-xs text-foreground flex-1 truncate">{field}</span>
                          </div>
                          <div className="flex gap-1 pl-5">
                            {Array.from({ length: groupCount || 2 }, (_, i) => i + 1).map((group) => (
                              <Button
                                key={group}
                                variant="outline"
                                size="sm"
                                className={cn(
                                  "h-6 px-3 text-xs flex-1",
                                  currentGroup === group && "bg-accent"
                                )}
                                onClick={() => onSeriesGroupChange(field, group)}
                              >
                                {group}
                              </Button>
                            ))}
                            <Button
                              variant="outline"
                              size="sm"
                              className={cn(
                                "h-6 px-3 text-xs flex-1",
                                currentGroup === 0 && "bg-accent"
                              )}
                              onClick={() => onSeriesGroupChange(field, 0)}
                            >
                              숨김
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 푸터 - 시리즈 설정이 필요한 경우에만 표시 */}
        {viewMode === 'legend' && needsSettings && (
          <div className="p-4 border-t flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs font-medium"
              onClick={() => setViewMode('settings')}
            >
              시리즈 설정
            </Button>
          </div>
        )}
      </div>
    );
  }

  // 하단 레이아웃
  if (isBottom) {
    return (
      <div className="border-t bg-card/50 flex-shrink-0 overflow-x-auto">
        <div className="flex min-w-max">
          {/* 메인 레전드 영역 */}
          <div className="flex-shrink-0 px-4 py-3" style={{ minWidth: '280px' }}>
            {/* 동기화 영역 차트 시리즈 선택 */}
            {chartType === 'synced-area' && onSyncedAreaFieldChange && (
              <div className="mb-3 flex gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">좌측:</label>
                  <Select value={syncedAreaLeftField || ""} onValueChange={(value) => onSyncedAreaFieldChange('left', value)}>
                    <SelectTrigger className="w-32 h-7 text-xs">
                      <SelectValue placeholder="시리즈 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {seriesFields.map((field) => (
                        <SelectItem key={field} value={field}>{field}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">우측:</label>
                  <Select value={syncedAreaRightField || ""} onValueChange={(value) => onSyncedAreaFieldChange('right', value)}>
                    <SelectTrigger className="w-32 h-7 text-xs">
                      <SelectValue placeholder="시리즈 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {seriesFields.map((field) => (
                        <SelectItem key={field} value={field}>{field}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* 회귀 산점도 시리즈 선택 */}
            {chartType === 'regression-scatter' && onRegressionScatterFieldChange && (
              <div className="mb-3 flex gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">X축:</label>
                  <Select value={regressionScatterXField || ""} onValueChange={(value) => onRegressionScatterFieldChange('x', value)}>
                    <SelectTrigger className="w-32 h-7 text-xs">
                      <SelectValue placeholder="시리즈 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {seriesFields.map((field) => (
                        <SelectItem key={field} value={field}>{field}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Y축:</label>
                  <Select value={regressionScatterYField || ""} onValueChange={(value) => onRegressionScatterFieldChange('y', value)}>
                    <SelectTrigger className="w-32 h-7 text-xs">
                      <SelectValue placeholder="시리즈 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {seriesFields.map((field) => (
                        <SelectItem key={field} value={field}>{field}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {regressionStats && (
                  <span className="text-xs text-muted-foreground">R² = {regressionStats.r2.toFixed(4)}</span>
                )}
              </div>
            )}

            {/* X축 레이블 (호버 시) */}
            <div className="text-xs font-medium text-muted-foreground mb-2 h-4">
              {chartType === "ranking-bar"
                ? (hoveredLabel ? "선택된 항목" : <span className="italic">차트를 가리켜보세요</span>)
                : chartType === "geo-grid"
                ? ""
                : chartType === "multi-level-treemap"
                ? (treemapStats?.isDrilledDown
                    ? <span className="italic">클릭하여 상위로 이동</span>
                    : <span className="italic">시리즈를 클릭하여 상세 보기</span>)
                : chartType === "regression-scatter"
                ? (hoveredLabel ? "" : <span className="italic">차트를 가리켜보세요</span>)
                : (hoveredLabel || <span className="italic">차트를 가리켜보세요</span>)
              }
            </div>

            {/* 레전드 아이템들 (가로 배치) */}
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {chartType === "ranking-bar" && rankingData ? (
                // 랭킹막대: 호버된 항목만
                (() => {
                  const hoveredItem = rankingData.find(item => item.name === hoveredLabel);
                  const hoveredIndex = rankingData.findIndex(item => item.name === hoveredLabel);
                  if (!hoveredItem) return null;
                  return (
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-2 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: interpolateColor(RANKING_COLOR_START, RANKING_COLOR_END, hoveredIndex / Math.max(1, rankingData.length - 1)) }}
                      />
                      <span className="text-xs text-muted-foreground">{hoveredItem.name}</span>
                      <span className="text-xs font-mono font-semibold">{formatValue(hoveredItem.value)}</span>
                      <span className="text-xs text-muted-foreground">({hoveredIndex + 1}위)</span>
                    </div>
                  );
                })()
              ) : chartType === "multi-level-treemap" && treemapStats ? (
                // 멀티레벨 트리맵
                treemapStats.isDrilledDown ? (
                  <div className="flex items-center gap-2">
                    {treemapStats.parentColor && (
                      <span className="w-2 h-2 flex-shrink-0" style={{ backgroundColor: treemapStats.parentColor }} />
                    )}
                    <span className="text-xs font-semibold">{treemapStats.parentName}</span>
                    <span className="text-xs text-muted-foreground">합계: {formatValue(treemapStats.totalSum)} | {treemapStats.itemCount}개</span>
                  </div>
                ) : (
                  treemapStats.seriesData?.map((series) => (
                    <div key={series.name} className="flex items-center gap-1.5">
                      <span className="w-2 h-2 flex-shrink-0" style={{ backgroundColor: series.color }} />
                      <span className="text-xs text-muted-foreground">{series.name}</span>
                      <span className="text-xs font-mono font-semibold">{formatValue(series.value)}</span>
                      <span className="text-xs text-muted-foreground">({series.percentage.toFixed(1)}%)</span>
                    </div>
                  ))
                )
              ) : (
                // 기본 레전드
                seriesFields.map((field) => {
                  const colorIdx = seriesFields.indexOf(field);
                  const color = seriesColors[colorIdx % seriesColors.length];
                  const enabled = enabledSeries.has(field);
                  const { value, isOutlier } = getSeriesValueWithState(field);
                  const originalValue = getOriginalValue(field);
                  const valueState = getValueState(field);

                  // 시리즈 타입 결정 (마커용)
                  let markerType: "line" | "bar" | "pie" = "line";
                  if (chartType === "pie" || chartType === "two-level-pie") markerType = "pie";
                  else if (chartType === "column" || chartType === "stacked" || chartType === "stacked-100" || chartType === "stacked-grouped") markerType = "bar";
                  else if ((chartType === "mixed" || chartType === "dual-axis") && yFieldTypes?.[field] === "column") markerType = "bar";

                  // 값 포맷팅
                  let displayValue = "";
                  if (valueState === 'missing') {
                    displayValue = "-";
                  } else if (value !== null) {
                    if (chartType === "stacked-100" && originalValue !== null) {
                      displayValue = `${originalValue.toLocaleString()} (${value.toFixed(1)}%)`;
                    } else {
                      displayValue = value.toLocaleString();
                    }
                  }

                  return (
                    <button
                      key={field}
                      onClick={() => onSeriesToggle(field)}
                      className={cn(
                        "flex items-center gap-1.5 py-1 rounded transition-opacity",
                        enabled ? "opacity-100" : "opacity-40"
                      )}
                    >
                      {/* 마커 */}
                      {markerType === "pie" ? (
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      ) : markerType === "bar" ? (
                        <span className="w-3 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                      ) : (
                        <span className="w-3 h-0.5 flex-shrink-0" style={{ backgroundColor: color }} />
                      )}

                      {/* 시리즈명 */}
                      <span className="text-xs text-muted-foreground">{field}</span>

                      {/* 이중축 배치 표시 */}
                      {chartType === 'dual-axis' && yAxisPlacements?.[field] && (
                        <span className="text-[10px] text-muted-foreground/70">
                          ({yAxisPlacements[field] === 'right' ? '우' : '좌'})
                        </span>
                      )}

                      {/* 값 */}
                      {displayValue && (
                        <span
                          className={cn(
                            "text-xs font-mono tabular-nums font-semibold",
                            isOutlier ? "text-red-500" : "text-foreground"
                          )}
                        >
                          {displayValue}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* 버튼 영역 */}
            {seriesFields.length > 0 && chartType !== "ranking-bar" && chartType !== "geo-grid" && chartType !== "multi-level-treemap" && chartType !== "regression-scatter" && (
              <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onToggleAll(!allEnabled)}
                >
                  {allEnabled ? "전체 해제" : "전체 선택"}
                </Button>

                {/* 설정 버튼 */}
                {((chartType === 'mixed' || chartType === 'dual-axis') && onYFieldTypeChange ||
                  (chartType === 'stacked-grouped' && onGroupCountChange)) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                  >
                    {isSettingsOpen ? "설정 닫기" : "시리즈 설정"}
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* 시리즈 타입 설정 사이드바 (혼합/이중축) */}
          {(chartType === 'mixed' || chartType === 'dual-axis') && onYFieldTypeChange && isSettingsOpen && (
            <div className="border-l px-4 py-3 flex-shrink-0" style={{ minWidth: '220px' }}>
              <h4 className="text-xs font-medium text-muted-foreground mb-2">시리즈별 타입 설정</h4>
              <div className="space-y-2">
                {seriesFields.map((field, idx) => {
                  const currentType = getCurrentTypeForField(field);
                  const color = seriesColors[idx % seriesColors.length];
                  return (
                    <div key={field} className="flex items-center gap-2">
                      <span className="w-3 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-xs text-muted-foreground flex-1 truncate">{field}</span>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" className={cn("h-6 px-2 text-xs", currentType === "line" && "bg-accent")} onClick={() => onYFieldTypeChange(field, "line")}>라인</Button>
                        <Button variant="outline" size="sm" className={cn("h-6 px-2 text-xs", currentType === "column" && "bg-accent")} onClick={() => onYFieldTypeChange(field, "column")}>막대</Button>
                        <Button variant="outline" size="sm" className={cn("h-6 px-2 text-xs", currentType === "none" && "bg-accent")} onClick={() => onYFieldTypeChange(field, "none")}>숨김</Button>
                      </div>
                      {/* 이중축 좌/우 설정 */}
                      {chartType === 'dual-axis' && onYAxisPlacementChange && (
                        <div className="flex gap-1 ml-2">
                          <Button variant="outline" size="sm" className={cn("h-6 px-2 text-xs", yAxisPlacements?.[field] === "left" && "bg-accent")} onClick={() => onYAxisPlacementChange(field, "left")}>좌</Button>
                          <Button variant="outline" size="sm" className={cn("h-6 px-2 text-xs", yAxisPlacements?.[field] === "right" && "bg-accent")} onClick={() => onYAxisPlacementChange(field, "right")}>우</Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 그룹형 누적막대 설정 사이드바 */}
          {chartType === 'stacked-grouped' && onGroupCountChange && onSeriesGroupChange && isSettingsOpen && (
            <div className="border-l px-4 py-3 flex-shrink-0" style={{ minWidth: '220px' }}>
              <h4 className="text-xs font-medium text-muted-foreground mb-2">시리즈별 그룹 설정</h4>
              <div className="mb-3">
                <span className="text-xs text-muted-foreground">그룹 개수: </span>
                <div className="flex gap-1 mt-1">
                  {[2, 3, 4].map((count) => (
                    <Button key={count} variant="outline" size="sm" className={cn("h-6 px-3 text-xs", groupCount === count && "bg-accent")} onClick={() => onGroupCountChange(count)}>{count}</Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                {seriesFields.map((field, idx) => {
                  const currentGroup = seriesGroupAssignments?.[field] ?? 1;
                  const color = seriesColors[idx % seriesColors.length];
                  return (
                    <div key={field} className="flex items-center gap-2">
                      <span className="w-3 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-xs text-muted-foreground flex-1 truncate">{field}</span>
                      <div className="flex gap-1">
                        {Array.from({ length: groupCount || 2 }, (_, i) => i + 1).map((group) => (
                          <Button key={group} variant="outline" size="sm" className={cn("h-6 px-2 text-xs", currentGroup === group && "bg-accent")} onClick={() => onSeriesGroupChange(field, group)}>{group}</Button>
                        ))}
                        <Button variant="outline" size="sm" className={cn("h-6 px-2 text-xs", currentGroup === 0 && "bg-accent")} onClick={() => onSeriesGroupChange(field, 0)}>숨김</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 수직 레이아웃 (하단 패널로 변경)
  return (
    <div className="flex border-t bg-card/50 flex-shrink-0 overflow-x-auto" style={{ minHeight: '100px' }}>
      <div
        className="flex-shrink-0 flex flex-col px-4 py-2"
        style={{ width: '260px' }}
      >
      {/* 기존 title, description */}
      {title && (
        <h3 className="text-sm font-semibold text-muted-foreground mb-1 mt-2">
          {title}
        </h3>
      )}
      {description && (
        <p className="text-xs text-muted-foreground">
          {description}
        </p>
      )}

      {/* 동기화 영역 차트 시리즈 선택 */}
      {chartType === 'synced-area' && onSyncedAreaFieldChange && (
        <div className="mb-3 space-y-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">좌측 차트</label>
            <Select value={syncedAreaLeftField || ""} onValueChange={(value) => onSyncedAreaFieldChange('left', value)}>
              <SelectTrigger className="w-full h-8 text-xs">
                <SelectValue placeholder="시리즈 선택" />
              </SelectTrigger>
              <SelectContent>
                {seriesFields.map((field) => (
                  <SelectItem key={field} value={field}>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: seriesColors[seriesFields.indexOf(field) % seriesColors.length] }}
                      />
                      {field}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">우측 차트</label>
            <Select value={syncedAreaRightField || ""} onValueChange={(value) => onSyncedAreaFieldChange('right', value)}>
              <SelectTrigger className="w-full h-8 text-xs">
                <SelectValue placeholder="시리즈 선택" />
              </SelectTrigger>
              <SelectContent>
                {seriesFields.map((field) => (
                  <SelectItem key={field} value={field}>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: seriesColors[seriesFields.indexOf(field) % seriesColors.length] }}
                      />
                      {field}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* 회귀 산점도 시리즈 선택 */}
      {chartType === 'regression-scatter' && onRegressionScatterFieldChange && (
        <div className="mb-3 space-y-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">X축</label>
            <Select value={regressionScatterXField || ""} onValueChange={(value) => onRegressionScatterFieldChange('x', value)}>
              <SelectTrigger className="w-full h-8 text-xs">
                <SelectValue placeholder="시리즈 선택" />
              </SelectTrigger>
              <SelectContent>
                {seriesFields.map((field) => (
                  <SelectItem key={field} value={field}>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: seriesColors[seriesFields.indexOf(field) % seriesColors.length] }}
                      />
                      {field}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Y축</label>
            <Select value={regressionScatterYField || ""} onValueChange={(value) => onRegressionScatterFieldChange('y', value)}>
              <SelectTrigger className="w-full h-8 text-xs">
                <SelectValue placeholder="시리즈 선택" />
              </SelectTrigger>
              <SelectContent>
                {seriesFields.map((field) => (
                  <SelectItem key={field} value={field}>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: seriesColors[seriesFields.indexOf(field) % seriesColors.length] }}
                      />
                      {field}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* X축 레이블 영역 + 설정 버튼 */}
      <div className="mb-3 flex items-start gap-2">
        <div className="flex-1 px-0 py-0 text-xs font-medium text-muted-foreground flex items-start">
          {chartType === "ranking-bar"
            ? (hoveredLabel ? "선택된 항목" : <span className="italic">차트를 가리켜보세요</span>)
            : chartType === "geo-grid"
            ? ""
            : chartType === "multi-level-treemap"
            ? (treemapStats?.isDrilledDown
                ? <span className="italic">클릭하여 상위로 이동</span>
                : <span className="italic">시리즈를 클릭하여 상세 보기</span>)
            : chartType === "regression-scatter"
            ? (hoveredLabel ? "" : <span className="italic">차트를 가리켜보세요</span>)
            : (hoveredLabel || <span className="italic">차트를 가리켜보세요</span>)
          }
        </div>

        {/* 설정 버튼 - 혼합차트, 이중축, 그룹형 누적막대일 때 표시 */}
        {((chartType === 'mixed' || chartType === 'dual-axis') && onYFieldTypeChange ||
          (chartType === 'stacked-grouped' && onGroupCountChange)) && seriesFields.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-auto w-auto p-0 hover:bg-transparent"
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            title={chartType === 'stacked-grouped' ? "그룹 설정" : "시리즈 타입 설정"}
          >
            {isSettingsOpen ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {/* 레전드 리스트 (스크롤 가능) */}
      <div className={cn(
        "flex-1 space-y-1",
        (isExpanded || (chartType === "ranking-bar" && rankingData && rankingData.length > collapseThreshold)) && "max-h-[400px] overflow-y-auto"
      )}>
        {chartType === "ranking-bar" && rankingData ? (
          // 랭킹막대 전용 레전드 - 호버된 항목만 표시
          (() => {
            const hoveredItem = rankingData.find(item => item.name === hoveredLabel);
            const hoveredIndex = rankingData.findIndex(item => item.name === hoveredLabel);

            return (
              <div className="rounded-[10px] bg-gray-100 px-3.5 py-3 min-h-[72px] flex flex-col justify-center">
                {hoveredItem && (
                  <>
                    <div className="text-sm font-semibold text-[#4b433f]">{hoveredItem.name}</div>
                    <div className="w-full h-px bg-[#d9d2cc] my-2"></div>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: interpolateColor(RANKING_COLOR_START, RANKING_COLOR_END, hoveredIndex / Math.max(1, rankingData.length - 1)) }}
                      />
                      <span className="text-xs font-medium text-gray-700">{formatValue(hoveredItem.value)}</span>
                    </div>
                    <div className="text-xs text-[#8f8277] mt-1">순위: {hoveredIndex + 1}위</div>
                  </>
                )}
              </div>
            );
          })()
        ) : chartType === "geo-grid" ? (
          // 지도그리드 전용 레전드 - 호버된 지역 표시
          <div className="rounded-[10px] bg-gray-100 px-3.5 py-3 min-h-[72px] flex flex-col justify-center">
            {hoveredLabel && tooltipPayload && tooltipPayload[0] && (
              <>
                <div className="text-sm font-semibold text-gray-700">{hoveredLabel}</div>
                <div className="w-full h-px my-2 bg-gray-300"></div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tooltipPayload[0].color || "#388F76" }} />
                  {hoveredLabel === "한강" ? (
                    <span className="text-xs font-medium text-gray-700">
                      데이터는 없지만 분위기는 있습니다
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-gray-700">
                      {formatValue(tooltipPayload[0].value)}
                      {tooltipPayload[0].totalSum && (
                        <span className="ml-1">
                          (전체 합계의 {((tooltipPayload[0].value / tooltipPayload[0].totalSum) * 100).toFixed(0)}%)
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        ) : chartType === "multi-level-treemap" && treemapStats ? (
          // 멀티레벨 트리맵 전용 레전드
          <div className="rounded-[10px] bg-gray-100 px-3.5 py-3 min-h-[72px] flex flex-col justify-center">
            {treemapStats.isDrilledDown ? (
              // 드릴다운 상태: 시리즈명 + 합계 + 항목수
              <>
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  {treemapStats.parentColor && (
                    <span
                      className="w-2 h-2 flex-shrink-0"
                      style={{ backgroundColor: treemapStats.parentColor }}
                    />
                  )}
                  {treemapStats.parentName}
                </div>
                <div className="w-full h-px my-2 bg-gray-300"></div>
                <div className="text-xs text-gray-600 space-y-1">
                  <div>합계: {formatValue(treemapStats.totalSum)}</div>
                  <div>항목 수: {treemapStats.itemCount}개</div>
                </div>
              </>
            ) : (
              // 상위레벨: 시리즈별 총계 + 비중
              <div className="space-y-2">
                {treemapStats.seriesData?.map((series) => (
                  <div key={series.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 flex-shrink-0"
                        style={{ backgroundColor: series.color }}
                      />
                      <span className="text-xs text-gray-700">{series.name}</span>
                    </div>
                    <div className="text-xs text-gray-600">
                      {formatValue(series.value)} ({series.percentage.toFixed(1)}%)
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : chartType === "regression-scatter" ? (
          // 회귀 산점도: 호버된 포인트의 X/Y 값 표시
          <div className="rounded-[10px] bg-gray-100 px-3.5 py-3 min-h-[72px] flex flex-col justify-center">
            {tooltipPayload && tooltipPayload.length >= 2 ? (
              <>
                <div className="text-sm font-semibold text-gray-700 mb-2">{hoveredLabel || "선택된 포인트"}</div>
                <div className="w-full h-px bg-gray-300 mb-2"></div>
                <div className="space-y-1.5">
                  {tooltipPayload.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs text-gray-700">{item.dataKey}({idx === 0 ? 'X' : 'Y'}):</span>
                      <span className="text-xs font-medium text-gray-700">
                        {formatValue(item.value)}
                      </span>
                    </div>
                  ))}
                  {/* 이상치일 때만 회귀 잔차 표시 */}
                  {tooltipPayload[1]?.isOutlier && tooltipPayload[1]?.residual != null && (
                    <>
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-xs text-gray-700">상태:</span>
                        <span className="text-xs font-medium">
                          <span className="text-[#ef4444]">이상치</span>
                          <span className="text-gray-700"> (회귀 잔차 {tooltipPayload[1].residual >= 0 ? '+' : ''}{formatValue(tooltipPayload[1].residual)})</span>
                        </span>
                      </div>
                      <div className="text-xs text-gray-700 pt-0.5">
                        기준: |잔차| &gt; 잔차 IQR 범위
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <span className="text-xs text-gray-500 italic">차트를 가리켜보세요</span>
            )}
          </div>
        ) : (
          // 기존 레전드
          displayedSeries.map((field) => (
            <LegendItem
              key={field}
              name={field}
              color={seriesColors[seriesFields.indexOf(field) % seriesColors.length]}
              enabled={enabledSeries.has(field)}
              value={getSeriesValue(field)}
              originalValue={getOriginalValue(field)}
              valueState={getValueState(field)}
              onClick={() => onSeriesToggle(field)}
              chartType={chartType}
              yFieldTypes={yFieldTypes}
              yAxisPlacement={chartType === 'dual-axis' && yAxisPlacements ? yAxisPlacements[field] : undefined}
            />
          ))
        )}
      </div>

      {/* 하단 버튼 영역 (랭킹막대, 지도그리드, 멀티레벨트리맵, 회귀산점도에서는 숨김) */}
      {seriesFields.length > 0 && chartType !== "ranking-bar" && chartType !== "geo-grid" && chartType !== "multi-level-treemap" && chartType !== "regression-scatter" && (
        <div className="mt-4 pt-3 border-t space-y-2">
          {/* 전체 선택/해제 버튼 */}
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 text-xs font-medium"
            onClick={() => onToggleAll(!allEnabled)}
          >
            {allEnabled ? "전체 해제" : "전체 선택"}
          </Button>

          {/* 펼치기/접기 버튼 */}
          {seriesFields.length > collapseThreshold && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 text-xs border-dashed"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-3 h-3 mr-1" />
                  접기
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3 mr-1" />
                  +{seriesFields.length - collapseThreshold}개
                </>
              )}
            </Button>
          )}
        </div>
      )}
      </div>

      {/* 시리즈 타입 설정 사이드바 - 조건부 렌더링 */}
      {(chartType === 'mixed' || chartType === 'dual-axis') && onYFieldTypeChange && isSettingsOpen && (
        <ChartSettingsSidebar
          open={isSettingsOpen}
          seriesFields={seriesFields}
          seriesColors={seriesColors}
          getCurrentTypeForField={getCurrentTypeForField}
          onTypeChange={onYFieldTypeChange}
          chartType={chartType}
          yAxisPlacements={yAxisPlacements}
          onAxisPlacementChange={onYAxisPlacementChange}
        />
      )}

      {/* 그룹형 누적막대 설정 사이드바 */}
      {chartType === 'stacked-grouped' && onGroupCountChange && onSeriesGroupChange && isSettingsOpen && (
        <StackedGroupedSettingsSidebar
          open={isSettingsOpen}
          seriesFields={seriesFields}
          seriesColors={seriesColors}
          groupCount={groupCount || 2}
          seriesGroupAssignments={seriesGroupAssignments || {}}
          onGroupCountChange={onGroupCountChange}
          onSeriesGroupChange={onSeriesGroupChange}
        />
      )}
    </div>
  );
}
