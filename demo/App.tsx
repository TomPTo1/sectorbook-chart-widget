"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import ChartWidget from "../src/components/ChartWidget";
import { ChartLegendPanel } from "../src/components/components/chart-legend-panel";
import { expandSeriesColors, getThemeColors } from "../src/components/components/recharts-wrapper";
import type { ChartType, YAxisPlacement } from "../src/types/chart-config";

// 모든 차트 타입 (geo-grid 제외)
const ALL_CHART_TYPES: ChartType[] = [
  "line", "area", "area-100", "stacked-area", "synced-area",
  "column", "mixed", "stacked", "stacked-100", "stacked-grouped", "dual-axis",
  "pie", "two-level-pie", "treemap", "multi-level-treemap",
  "ranking-bar", "regression-scatter"
];

// 랜덤 시리즈 이름 풀
const SERIES_NAME_POOL = [
  "GDP성장률", "실업률", "물가상승률", "금리", "환율", "주가지수",
  "수출액", "수입액", "무역수지", "소비자물가", "생산자물가", "임금상승률",
  "가계부채", "기업부채", "정부부채", "외환보유액", "경상수지", "자본수지",
  "건설투자", "설비투자", "소비지출", "저축률", "실질소득", "명목소득",
  "제조업PMI", "서비스업PMI", "소비자신뢰지수", "기업경기실사지수"
];

// 스트레스 테스트용 랜덤 데이터 생성
function generateStressTestData(seed?: number) {
  const random = seed ? seededRandom(seed) : Math.random;

  // 랜덤 파라미터
  const seriesCount = Math.floor(random() * 9) + 2; // 2~10개 시리즈
  const dataPoints = Math.floor(random() * 31) + 6; // 6~36개 데이터 포인트
  const outlierRate = random() * 0.15; // 0~15% 이상치 비율
  const missingRate = random() * 0.1; // 0~10% 결측치 비율
  const hasNegativeValues = random() > 0.5; // 50% 확률로 음수 포함
  const valueScale = Math.pow(10, Math.floor(random() * 4)); // 1, 10, 100, 1000 스케일

  // 랜덤 시리즈 선택
  const shuffled = [...SERIES_NAME_POOL].sort(() => random() - 0.5);
  const selectedSeries = shuffled.slice(0, seriesCount);

  // 데이터 생성
  const data = [];
  const baseDate = new Date(2020 + Math.floor(random() * 5), Math.floor(random() * 12), 1);

  for (let i = 0; i < dataPoints; i++) {
    const date = new Date(baseDate);
    date.setMonth(date.getMonth() + i);

    const row: Record<string, any> = {
      date: date.toISOString().slice(0, 7),
      date_display: `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}`,
    };

    selectedSeries.forEach((series, idx) => {
      // 결측치 처리
      if (random() < missingRate) {
        row[series] = null;
        return;
      }

      // 기본 값 생성 (시리즈별로 다른 패턴)
      const baseValue = (random() * 5 + 1) * valueScale;
      const trend = Math.sin(i / (3 + idx)) * valueScale * 0.3;
      const noise = (random() - 0.5) * valueScale * 0.2;
      let value = baseValue + trend + noise;

      // 이상치 처리
      if (random() < outlierRate) {
        const isUpper = random() > 0.5;
        value = isUpper
          ? baseValue * (2 + random() * 3) // 상한 이상치: 2~5배
          : baseValue * (random() * 0.3); // 하한 이상치: 0~30%
      }

      // 음수 값 처리
      if (hasNegativeValues && random() > 0.7) {
        value = -Math.abs(value) * random();
      }

      row[series] = Math.round(value * 100) / 100;
    });

    data.push(row);
  }

  return {
    data,
    seriesFields: selectedSeries,
    metadata: {
      seriesCount,
      dataPoints,
      outlierRate: Math.round(outlierRate * 100),
      missingRate: Math.round(missingRate * 100),
      hasNegativeValues,
      valueScale,
    }
  };
}

// 시드 기반 랜덤 함수
function seededRandom(seed: number) {
  return function() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

// Error Boundary
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; onError?: (error: Error) => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error) {
    this.props.onError?.(error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="text-red-500 p-5">
          <strong>Chart Error:</strong> {this.state.error?.message}
          <pre className="text-xs mt-2 overflow-auto max-h-40">{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  // 데이터 시드 (리프레시 시 새 데이터)
  const [dataSeed, setDataSeed] = useState(() => Date.now());

  // 생성된 데이터
  const generatedData = useMemo(() => generateStressTestData(dataSeed), [dataSeed]);
  const { data, seriesFields, metadata } = generatedData;

  // 차트 타입 (랜덤 초기값)
  const [chartType, setChartType] = useState<ChartType>(() =>
    ALL_CHART_TYPES[Math.floor(Math.random() * ALL_CHART_TYPES.length)]
  );

  const [showOutliers, setShowOutliers] = useState(false);
  const [showMissingValues, setShowMissingValues] = useState(false);
  const [enabledSeries, setEnabledSeries] = useState<Set<string>>(new Set(seriesFields));

  // 시리즈 필드 변경 시 enabledSeries 업데이트
  useEffect(() => {
    setEnabledSeries(new Set(seriesFields));
  }, [seriesFields]);

  // Tooltip 상태
  const [tooltipPayload, setTooltipPayload] = useState<any[] | null>(null);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);

  // 혼합/이중축 차트용 상태
  const yFieldTypes = useMemo(() => {
    const types: Record<string, "column" | "line"> = {};
    seriesFields.forEach((field, i) => {
      types[field] = i % 2 === 0 ? "line" : "column";
    });
    return types;
  }, [seriesFields]);

  const [yFieldTypesState, setYFieldTypesState] = useState(yFieldTypes);
  useEffect(() => setYFieldTypesState(yFieldTypes), [yFieldTypes]);

  const yAxisPlacements = useMemo(() => {
    const placements: Record<string, YAxisPlacement> = {};
    seriesFields.forEach((field, i) => {
      placements[field] = i < seriesFields.length / 2 ? "left" : "right";
    });
    return placements;
  }, [seriesFields]);

  const [yAxisPlacementsState, setYAxisPlacementsState] = useState(yAxisPlacements);
  useEffect(() => setYAxisPlacementsState(yAxisPlacements), [yAxisPlacements]);

  // 그룹형 누적막대용 상태
  const [groupCount, setGroupCount] = useState(2);
  const seriesGroupAssignments = useMemo(() => {
    const assignments: Record<string, number> = {};
    seriesFields.forEach((field, i) => {
      assignments[field] = (i % groupCount) + 1;
    });
    return assignments;
  }, [seriesFields, groupCount]);

  const [seriesGroupState, setSeriesGroupState] = useState(seriesGroupAssignments);
  useEffect(() => setSeriesGroupState(seriesGroupAssignments), [seriesGroupAssignments]);

  // 동기화 영역 차트용
  const [syncedAreaLeftField, setSyncedAreaLeftField] = useState<string | null>(seriesFields[0] || null);
  const [syncedAreaRightField, setSyncedAreaRightField] = useState<string | null>(seriesFields[1] || null);
  useEffect(() => {
    setSyncedAreaLeftField(seriesFields[0] || null);
    setSyncedAreaRightField(seriesFields[1] || null);
  }, [seriesFields]);

  // 회귀 산점도용
  const [regressionScatterXField, setRegressionScatterXField] = useState<string | null>(seriesFields[0] || null);
  const [regressionScatterYField, setRegressionScatterYField] = useState<string | null>(seriesFields[1] || null);
  const [regressionStats, setRegressionStats] = useState<{ r2: number } | null>(null);
  useEffect(() => {
    setRegressionScatterXField(seriesFields[0] || null);
    setRegressionScatterYField(seriesFields[1] || null);
  }, [seriesFields]);

  // 트리맵 통계
  const [treemapStats, setTreemapStats] = useState<any>(null);

  // 테마 색상
  const themeColors = useMemo(() => getThemeColors(), []);

  // 시리즈 색상
  const seriesColors = useMemo(() => {
    const baseColors = themeColors.seriesColors.length > 0
      ? themeColors.seriesColors
      : ["hsl(12, 76%, 61%)", "hsl(173, 58%, 39%)", "hsl(197, 37%, 24%)", "hsl(43, 74%, 66%)", "hsl(27, 87%, 67%)"];
    return expandSeriesColors(baseColors, seriesFields.length);
  }, [themeColors.seriesColors, seriesFields.length]);

  // 콜백들
  const toggleSeries = useCallback((field: string) => {
    setEnabledSeries((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  }, []);

  const toggleAllSeries = useCallback((enable: boolean) => {
    setEnabledSeries(enable ? new Set(seriesFields) : new Set());
  }, [seriesFields]);

  const handleYFieldTypeChange = useCallback((field: string, type: "column" | "line" | "none") => {
    if (type === "none") {
      setEnabledSeries((prev) => { const next = new Set(prev); next.delete(field); return next; });
    } else {
      setEnabledSeries((prev) => { const next = new Set(prev); next.add(field); return next; });
      setYFieldTypesState((prev) => ({ ...prev, [field]: type }));
    }
  }, []);

  const handleYAxisPlacementChange = useCallback((field: string, placement: YAxisPlacement) => {
    setYAxisPlacementsState((prev) => ({ ...prev, [field]: placement }));
  }, []);

  const handleGroupCountChange = useCallback((count: number) => setGroupCount(count), []);

  const handleSeriesGroupChange = useCallback((field: string, group: number) => {
    setSeriesGroupState((prev) => ({ ...prev, [field]: group }));
  }, []);

  const handleSyncedAreaFieldChange = useCallback((position: 'left' | 'right', field: string) => {
    if (position === 'left') setSyncedAreaLeftField(field);
    else setSyncedAreaRightField(field);
  }, []);

  const handleRegressionScatterFieldChange = useCallback((axis: 'x' | 'y', field: string) => {
    if (axis === 'x') setRegressionScatterXField(field);
    else setRegressionScatterYField(field);
  }, []);

  // 이상치/결측치 지원 여부
  const OUTLIER_UNSUPPORTED: ChartType[] = ["stacked", "stacked-100", "stacked-grouped", "area", "area-100", "stacked-area", "synced-area", "pie", "two-level-pie", "treemap", "multi-level-treemap", "ranking-bar", "geo-grid", "regression-scatter"];
  const MISSING_UNSUPPORTED: ChartType[] = ["pie", "two-level-pie", "treemap", "multi-level-treemap", "ranking-bar", "stacked-area", "synced-area", "geo-grid", "regression-scatter"];
  const supportsOutliers = !OUTLIER_UNSUPPORTED.includes(chartType);
  const supportsMissing = !MISSING_UNSUPPORTED.includes(chartType);

  // 랭킹 데이터
  const rankingData = useMemo(() => {
    if (chartType !== "ranking-bar") return null;
    const lastData = data[data.length - 1];
    return seriesFields
      .map((field) => ({
        name: field,
        value: typeof lastData?.[field] === "number" ? lastData[field] as number : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [chartType, data, seriesFields]);

  // 새 데이터 생성
  const regenerateData = () => {
    setDataSeed(Date.now());
    setChartType(ALL_CHART_TYPES[Math.floor(Math.random() * ALL_CHART_TYPES.length)]);
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* 데이터 프로파일링 헤더 */}
      <div className="px-4 py-2 border-b bg-muted/30 flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          <span className="font-semibold">Stress Test Data:</span>
          <span>시리즈: <strong>{metadata.seriesCount}개</strong></span>
          <span>포인트: <strong>{metadata.dataPoints}개</strong></span>
          <span>이상치: <strong>{metadata.outlierRate}%</strong></span>
          <span>결측치: <strong>{metadata.missingRate}%</strong></span>
          <span>음수: <strong>{metadata.hasNegativeValues ? 'Y' : 'N'}</strong></span>
          <span>스케일: <strong>{metadata.valueScale}x</strong></span>
        </div>
        <button
          onClick={regenerateData}
          className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs font-medium hover:bg-primary/90"
        >
          새 데이터 생성
        </button>
      </div>

      {/* 메인 콘텐츠: Chart + Legend Panel */}
      <div className="flex-1 flex min-h-0">
        {/* 좌측: Chart */}
        <div className="flex-1 min-w-0 flex flex-col border-r">
          <div className="px-4 py-3 border-b">
            <h3 className="font-medium text-sm">차트 위젯 스트레스 테스트</h3>
          </div>
          <div className="flex-1 min-h-0 p-4">
            <ErrorBoundary key={dataSeed}>
              <ChartWidget
                data={data}
                seriesFields={seriesFields}
                chartType={chartType}
                enabledSeries={enabledSeries}
                height="100%"
                showOutliers={showOutliers}
                yFieldTypes={yFieldTypesState}
                yAxisPlacements={yAxisPlacementsState}
                seriesGroupAssignments={seriesGroupState}
                syncedAreaLeftField={syncedAreaLeftField}
                syncedAreaRightField={syncedAreaRightField}
                regressionScatterXField={regressionScatterXField}
                regressionScatterYField={regressionScatterYField}
                onTooltipChange={(payload) => setTooltipPayload(payload)}
                onHoveredLabelChange={(label) => setHoveredLabel(label)}
                onTreemapStatsChange={setTreemapStats}
                onRegressionStatsChange={(stats) => stats && setRegressionStats({ r2: stats.rSquared })}
              />
            </ErrorBoundary>
          </div>
        </div>

        {/* 우측: Legend Panel (300px) */}
        <div className="w-[300px] flex-shrink-0 flex flex-col bg-card">
          <ChartLegendPanel
            layout="sidePanel"
            seriesFields={seriesFields}
            seriesColors={seriesColors}
            enabledSeries={enabledSeries}
            tooltipPayload={tooltipPayload}
            hoveredLabel={hoveredLabel}
            analysisResult={null}
            rankingData={rankingData}
            onSeriesToggle={toggleSeries}
            onToggleAll={toggleAllSeries}
            chartType={chartType}
            yFieldTypes={yFieldTypesState}
            yAxisPlacements={yAxisPlacementsState}
            onYFieldTypeChange={handleYFieldTypeChange}
            onYAxisPlacementChange={handleYAxisPlacementChange}
            groupCount={groupCount}
            seriesGroupAssignments={seriesGroupState}
            onGroupCountChange={handleGroupCountChange}
            onSeriesGroupChange={handleSeriesGroupChange}
            syncedAreaLeftField={syncedAreaLeftField || undefined}
            syncedAreaRightField={syncedAreaRightField || undefined}
            onSyncedAreaFieldChange={handleSyncedAreaFieldChange}
            regressionScatterXField={regressionScatterXField || undefined}
            regressionScatterYField={regressionScatterYField || undefined}
            onRegressionScatterFieldChange={handleRegressionScatterFieldChange}
            regressionStats={regressionStats}
            treemapStats={treemapStats}
            allowedChartTypes={ALL_CHART_TYPES}
            onChartTypeChange={setChartType}
            showOutliers={showOutliers}
            showMissingValues={showMissingValues}
            onShowOutliersChange={setShowOutliers}
            onShowMissingValuesChange={setShowMissingValues}
            supportsOutliers={supportsOutliers}
            supportsMissing={supportsMissing}
          />
        </div>
      </div>
    </div>
  );
}
