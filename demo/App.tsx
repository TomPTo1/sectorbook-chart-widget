"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import ChartWidget from "../src/components/ChartWidget";
import { ChartLegendPanel } from "../src/components/components/chart-legend-panel";
import { expandSeriesColors, getThemeColors } from "../src/components/components/recharts-wrapper";
import type { ChartType, YAxisPlacement } from "../src/types/chart-config";

// ============================================================
// sectorbook DataProfile 규약
// ============================================================
interface DataProfile {
  seriesCount: number;
  timePointCount: number;
  hasNegativeValues: boolean;
  hasOutliers: boolean;
  xAxisType: "시점" | "범주" | "순서";
}

interface PivotDataRow {
  date: string;
  date_display: string;
  [key: string]: string | number | null;
}

interface PivotScenario {
  id: string;
  name: string;
  accountGroup: string;
  unit: string;
  data: PivotDataRow[];
  seriesFields: string[];
  dataProfile: DataProfile;
  allowedCharts: ChartType[];
  recommendedChart: ChartType;
}

// ============================================================
// 계층적 시리즈 구조 (패싯용)
// ============================================================
interface SeriesNode {
  name: string;
  level: number;
  path: string[];
  children: SeriesNode[];
  unit?: string;
}

// 모든 차트 타입
const ALL_CHART_TYPES: ChartType[] = [
  "line", "area", "area-100", "stacked-area", "synced-area",
  "column", "mixed", "stacked", "stacked-100", "stacked-grouped", "dual-axis",
  "pie", "two-level-pie", "treemap", "multi-level-treemap",
  "ranking-bar", "regression-scatter"
];

// 분류기준 풀
const CRITERIA_POOL = ["업종별", "지역별", "품목별", "규모별", "기간별"];

// 레벨1 분류 풀
const LEVEL1_POOL: Record<string, string[]> = {
  "업종별": ["제조업", "서비스업", "건설업", "농림어업", "광업"],
  "지역별": ["수도권", "영남권", "호남권", "충청권", "강원제주권"],
  "품목별": ["에너지", "금속", "화학", "전자", "기계"],
  "규모별": ["대기업", "중견기업", "중소기업", "소기업"],
  "기간별": ["상반기", "하반기", "1분기", "2분기", "3분기", "4분기"],
};

// 레벨2 분류 풀
const LEVEL2_POOL: Record<string, string[]> = {
  "제조업": ["자동차", "반도체", "철강", "조선", "섬유"],
  "서비스업": ["금융", "통신", "유통", "관광", "의료"],
  "건설업": ["토목", "건축", "플랜트"],
  "수도권": ["서울", "경기", "인천"],
  "영남권": ["부산", "대구", "울산", "경남", "경북"],
  "호남권": ["광주", "전남", "전북"],
  "에너지": ["석유", "가스", "석탄", "전력"],
  "금속": ["철강", "비철금속", "귀금속"],
  "대기업": ["1000인이상", "500-999인"],
  "중소기업": ["50-299인", "10-49인"],
};

// 단위 풀
const UNIT_POOL = ["%", "억원", "천명", "개", "톤", "천대", "GWh", "백만달러"];

// ============================================================
// 스트레스 테스트용 계층적 시나리오 생성
// ============================================================
function generateHierarchicalScenarios(seed: number): PivotScenario[] {
  const random = seededRandom(seed);
  const scenarios: PivotScenario[] = [];

  // 1~3개 분류기준 선택
  const criteriaCount = Math.floor(random() * 3) + 1;
  const shuffledCriteria = [...CRITERIA_POOL].sort(() => random() - 0.5);
  const selectedCriteria = shuffledCriteria.slice(0, criteriaCount);

  // 시나리오 생성
  let scenarioIndex = 0;

  for (const criterion of selectedCriteria) {
    const level1Values = LEVEL1_POOL[criterion] || [];
    const selectedLevel1 = level1Values.slice(0, Math.floor(random() * 3) + 2);

    for (const l1Value of selectedLevel1) {
      // Level 1 시나리오
      const l1Scenario = createScenario(
        scenarioIndex++,
        `${l1Value} 종합`,
        criterion,
        [l1Value],
        random
      );
      scenarios.push(l1Scenario);

      // Level 2 시나리오들
      const level2Values = LEVEL2_POOL[l1Value] || [];
      if (level2Values.length > 0 && random() > 0.3) {
        const selectedLevel2 = level2Values.slice(0, Math.floor(random() * 4) + 2);

        for (const l2Value of selectedLevel2) {
          const l2Scenario = createScenario(
            scenarioIndex++,
            l2Value,
            `${criterion} > ${l1Value}`,
            [l1Value, l2Value],
            random
          );
          scenarios.push(l2Scenario);
        }
      }
    }
  }

  return scenarios;
}

function createScenario(
  index: number,
  name: string,
  accountGroup: string,
  path: string[],
  random: () => number
): PivotScenario {
  // 랜덤 파라미터
  const seriesCount = Math.floor(random() * 8) + 2;
  const timePointCount = Math.floor(random() * 25) + 6;
  const hasNegativeValues = random() > 0.6;
  const hasOutliers = random() > 0.5;
  const unit = UNIT_POOL[Math.floor(random() * UNIT_POOL.length)];
  const valueScale = Math.pow(10, Math.floor(random() * 3));

  // 시리즈 필드 생성
  const seriesFields: string[] = [];
  for (let i = 0; i < seriesCount; i++) {
    seriesFields.push(`${name}_항목${i + 1}`);
  }

  // 데이터 생성
  const data: PivotDataRow[] = [];
  const baseDate = new Date(2020 + Math.floor(random() * 4), Math.floor(random() * 12), 1);

  for (let i = 0; i < timePointCount; i++) {
    const date = new Date(baseDate);
    date.setMonth(date.getMonth() + i);

    const row: PivotDataRow = {
      date: date.toISOString().slice(0, 7),
      date_display: `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}`,
    };

    seriesFields.forEach((field, idx) => {
      // 결측치 (5% 확률)
      if (random() < 0.05) {
        row[field] = null;
        return;
      }

      const baseValue = (random() * 5 + 1) * valueScale;
      const trend = Math.sin(i / (3 + idx)) * valueScale * 0.3;
      const noise = (random() - 0.5) * valueScale * 0.2;
      let value = baseValue + trend + noise;

      // 이상치 (hasOutliers면 10% 확률)
      if (hasOutliers && random() < 0.1) {
        value = random() > 0.5 ? baseValue * 3 : baseValue * 0.2;
      }

      // 음수
      if (hasNegativeValues && random() > 0.7) {
        value = -Math.abs(value) * random();
      }

      row[field] = Math.round(value * 100) / 100;
    });

    data.push(row);
  }

  // 데이터 특성에 따른 허용 차트 결정
  const allowedCharts = determineAllowedCharts(seriesCount, hasNegativeValues, hasOutliers);
  const recommendedChart = allowedCharts[0];

  return {
    id: `scenario-${index}`,
    name,
    accountGroup,
    unit,
    data,
    seriesFields,
    dataProfile: {
      seriesCount,
      timePointCount,
      hasNegativeValues,
      hasOutliers,
      xAxisType: "시점",
    },
    allowedCharts,
    recommendedChart,
  };
}

function determineAllowedCharts(
  seriesCount: number,
  hasNegativeValues: boolean,
  hasOutliers: boolean
): ChartType[] {
  const charts: ChartType[] = ["line", "column"];

  if (!hasNegativeValues) {
    charts.push("area", "stacked", "stacked-100");
    if (seriesCount >= 3) {
      charts.push("pie", "treemap");
    }
  }

  if (seriesCount >= 2) {
    charts.push("mixed", "dual-axis");
  }

  if (seriesCount >= 3) {
    charts.push("ranking-bar");
  }

  return charts;
}

function seededRandom(seed: number) {
  return function() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

// ============================================================
// UI Components
// ============================================================

// 패싯 필터
interface FacetFilterProps {
  scenarios: PivotScenario[];
  selectedFilters: Map<number, string>;
  onFilterChange: (level: number, value: string | null) => void;
}

const FacetFilter: React.FC<FacetFilterProps> = ({
  scenarios,
  selectedFilters,
  onFilterChange,
}) => {
  // 레벨별 분류기준과 값 추출
  const facets = useMemo(() => {
    const result: { level: number; criterion: string; values: Set<string> }[] = [];

    for (const scenario of scenarios) {
      const pathParts = scenario.accountGroup.split(' > ').map(p => p.trim());

      for (let level = 0; level < pathParts.length; level++) {
        const value = pathParts[level];
        if (!value) continue;

        // 상위 필터 확인
        let matchesFilter = true;
        for (let i = 0; i < level; i++) {
          const selectedValue = selectedFilters.get(i);
          if (selectedValue && pathParts[i] !== selectedValue) {
            matchesFilter = false;
            break;
          }
        }
        if (!matchesFilter) continue;

        let facet = result.find(f => f.level === level);
        if (!facet) {
          facet = {
            level,
            criterion: level === 0 ? "분류" : `상세${level}`,
            values: new Set()
          };
          result.push(facet);
        }
        facet.values.add(value);
      }
    }

    result.sort((a, b) => a.level - b.level);
    return result;
  }, [scenarios, selectedFilters]);

  if (facets.length === 0) return null;

  return (
    <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
      <div className="text-xs font-medium text-muted-foreground mb-2">패싯 필터</div>
      {facets.map(({ level, criterion, values }) => {
        const selectedValue = selectedFilters.get(level);
        const valuesArray = Array.from(values).sort();

        return (
          <div key={level} className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-violet-600 min-w-[50px]">
              {criterion}:
            </span>
            <div className="flex flex-wrap gap-1">
              {valuesArray.map(value => {
                const isSelected = selectedValue === value;
                return (
                  <button
                    key={value}
                    onClick={() => onFilterChange(level, isSelected ? null : value)}
                    className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                      isSelected
                        ? 'bg-violet-500 text-white'
                        : 'bg-background text-foreground hover:bg-violet-100'
                    }`}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {selectedFilters.size > 0 && (
        <button
          onClick={() => {
            for (const level of selectedFilters.keys()) {
              onFilterChange(level, null);
            }
          }}
          className="text-xs text-muted-foreground hover:text-foreground mt-1"
        >
          필터 초기화
        </button>
      )}
    </div>
  );
};

// 시나리오 카드
interface ScenarioCardProps {
  scenario: PivotScenario;
  isSelected: boolean;
  onSelect: () => void;
}

const ScenarioCard: React.FC<ScenarioCardProps> = ({
  scenario,
  isSelected,
  onSelect,
}) => {
  const [expanded, setExpanded] = useState(false);
  const { dataProfile } = scenario;

  return (
    <div
      onClick={onSelect}
      className={`rounded-lg border cursor-pointer transition-all ${
        isSelected
          ? 'bg-cyan-50 border-cyan-400 shadow-md ring-2 ring-cyan-300'
          : 'bg-card border-border hover:bg-muted/50'
      }`}
    >
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="p-0.5 hover:bg-muted rounded"
          >
            {expanded ? '▼' : '▶'}
          </button>
          <span className="font-medium text-sm">{scenario.name}</span>
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
            {scenario.unit}
          </span>
          <span className="text-xs bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded">
            {dataProfile.seriesCount}개 시리즈
          </span>
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
            추천: {scenario.recommendedChart}
          </span>
          {isSelected && (
            <span className="text-xs bg-cyan-500 text-white px-2 py-0.5 rounded">
              차트 표시중
            </span>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t p-3 bg-muted/30 text-xs space-y-2">
          <div>
            <span className="text-muted-foreground">분류 경로: </span>
            <span className="font-medium">{scenario.accountGroup}</span>
          </div>
          <div>
            <span className="text-muted-foreground">데이터 특성: </span>
            <span>
              {dataProfile.timePointCount}개 시점
              {dataProfile.hasNegativeValues && " · 음수포함"}
              {dataProfile.hasOutliers && " · 이상치"}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block mb-1">허용 차트:</span>
            <div className="flex flex-wrap gap-1">
              {scenario.allowedCharts.map(chart => (
                <span
                  key={chart}
                  className={`px-1.5 py-0.5 rounded ${
                    chart === scenario.recommendedChart
                      ? 'bg-purple-200 text-purple-800 font-medium'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {chart}
                </span>
              ))}
            </div>
          </div>
          <div>
            <span className="text-muted-foreground block mb-1">시리즈:</span>
            <div className="flex flex-wrap gap-1">
              {scenario.seriesFields.map(field => (
                <span key={field} className="bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded">
                  {field}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Error Boundary
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
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

// ============================================================
// Main App
// ============================================================
export default function App() {
  // 데이터 시드
  const [dataSeed, setDataSeed] = useState(() => Date.now());

  // 시나리오 생성
  const scenarios = useMemo(() => generateHierarchicalScenarios(dataSeed), [dataSeed]);

  // 선택된 시나리오
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);

  // 패싯 필터
  const [selectedFilters, setSelectedFilters] = useState<Map<number, string>>(new Map());

  // 필터링된 시나리오
  const filteredScenarios = useMemo(() => {
    if (selectedFilters.size === 0) return scenarios;

    return scenarios.filter(scenario => {
      const pathParts = scenario.accountGroup.split(' > ').map(p => p.trim());

      for (const [level, filterValue] of selectedFilters.entries()) {
        if (pathParts[level] !== filterValue) {
          return false;
        }
      }
      return true;
    });
  }, [scenarios, selectedFilters]);

  // 선택된 시나리오
  const selectedScenario = useMemo(() => {
    return scenarios.find(s => s.id === selectedScenarioId) || filteredScenarios[0] || null;
  }, [scenarios, selectedScenarioId, filteredScenarios]);

  // 첫 렌더링 시 첫 시나리오 선택
  useEffect(() => {
    if (!selectedScenarioId && filteredScenarios.length > 0) {
      setSelectedScenarioId(filteredScenarios[0].id);
    }
  }, [filteredScenarios, selectedScenarioId]);

  // 차트 상태
  const [chartType, setChartType] = useState<ChartType>("column");
  const [showOutliers, setShowOutliers] = useState(false);
  const [showMissingValues, setShowMissingValues] = useState(false);

  // 시나리오 변경 시 차트 타입 업데이트
  useEffect(() => {
    if (selectedScenario) {
      setChartType(selectedScenario.recommendedChart);
    }
  }, [selectedScenario]);

  // 시리즈 상태
  const seriesFields = selectedScenario?.seriesFields || [];
  const [enabledSeries, setEnabledSeries] = useState<Set<string>>(new Set());

  useEffect(() => {
    setEnabledSeries(new Set(seriesFields));
  }, [seriesFields]);

  // Tooltip 상태
  const [tooltipPayload, setTooltipPayload] = useState<any[] | null>(null);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);

  // 혼합/이중축 상태
  const [yFieldTypesState, setYFieldTypesState] = useState<Record<string, "column" | "line">>({});
  const [yAxisPlacementsState, setYAxisPlacementsState] = useState<Record<string, YAxisPlacement>>({});

  useEffect(() => {
    const types: Record<string, "column" | "line"> = {};
    const placements: Record<string, YAxisPlacement> = {};
    seriesFields.forEach((field, i) => {
      types[field] = i % 2 === 0 ? "line" : "column";
      placements[field] = i < seriesFields.length / 2 ? "left" : "right";
    });
    setYFieldTypesState(types);
    setYAxisPlacementsState(placements);
  }, [seriesFields]);

  // 그룹 상태
  const [groupCount, setGroupCount] = useState(2);
  const [seriesGroupState, setSeriesGroupState] = useState<Record<string, number>>({});

  useEffect(() => {
    const assignments: Record<string, number> = {};
    seriesFields.forEach((field, i) => {
      assignments[field] = (i % groupCount) + 1;
    });
    setSeriesGroupState(assignments);
  }, [seriesFields, groupCount]);

  // 동기화/회귀 필드
  const [syncedAreaLeftField, setSyncedAreaLeftField] = useState<string | null>(null);
  const [syncedAreaRightField, setSyncedAreaRightField] = useState<string | null>(null);
  const [regressionScatterXField, setRegressionScatterXField] = useState<string | null>(null);
  const [regressionScatterYField, setRegressionScatterYField] = useState<string | null>(null);
  const [regressionStats, setRegressionStats] = useState<{ r2: number } | null>(null);
  const [treemapStats, setTreemapStats] = useState<any>(null);

  useEffect(() => {
    setSyncedAreaLeftField(seriesFields[0] || null);
    setSyncedAreaRightField(seriesFields[1] || null);
    setRegressionScatterXField(seriesFields[0] || null);
    setRegressionScatterYField(seriesFields[1] || null);
  }, [seriesFields]);

  // 테마 색상
  const themeColors = useMemo(() => getThemeColors(), []);
  const seriesColors = useMemo(() => {
    const baseColors = themeColors.seriesColors.length > 0
      ? themeColors.seriesColors
      : ["hsl(12, 76%, 61%)", "hsl(173, 58%, 39%)", "hsl(197, 37%, 24%)", "hsl(43, 74%, 66%)", "hsl(27, 87%, 67%)"];
    return expandSeriesColors(baseColors, seriesFields.length);
  }, [themeColors.seriesColors, seriesFields.length]);

  // 콜백들
  const handleFilterChange = useCallback((level: number, value: string | null) => {
    setSelectedFilters(prev => {
      const next = new Map(prev);
      if (value === null) {
        next.delete(level);
        for (const key of next.keys()) {
          if (key > level) next.delete(key);
        }
      } else {
        next.set(level, value);
        for (const key of next.keys()) {
          if (key > level) next.delete(key);
        }
      }
      return next;
    });
  }, []);

  const toggleSeries = useCallback((field: string) => {
    setEnabledSeries(prev => {
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
      setEnabledSeries(prev => { const next = new Set(prev); next.delete(field); return next; });
    } else {
      setEnabledSeries(prev => { const next = new Set(prev); next.add(field); return next; });
      setYFieldTypesState(prev => ({ ...prev, [field]: type }));
    }
  }, []);

  // 이상치/결측치 지원
  const OUTLIER_UNSUPPORTED: ChartType[] = ["stacked", "stacked-100", "stacked-grouped", "area", "area-100", "stacked-area", "synced-area", "pie", "two-level-pie", "treemap", "multi-level-treemap", "ranking-bar", "geo-grid", "regression-scatter"];
  const MISSING_UNSUPPORTED: ChartType[] = ["pie", "two-level-pie", "treemap", "multi-level-treemap", "ranking-bar", "stacked-area", "synced-area", "geo-grid", "regression-scatter"];
  const supportsOutliers = !OUTLIER_UNSUPPORTED.includes(chartType);
  const supportsMissing = !MISSING_UNSUPPORTED.includes(chartType);

  // 랭킹 데이터
  const rankingData = useMemo(() => {
    if (chartType !== "ranking-bar" || !selectedScenario) return null;
    const lastData = selectedScenario.data[selectedScenario.data.length - 1];
    return seriesFields
      .map(field => ({
        name: field,
        value: typeof lastData?.[field] === "number" ? lastData[field] as number : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [chartType, selectedScenario, seriesFields]);

  // 새 데이터 생성
  const regenerateData = () => {
    setDataSeed(Date.now());
    setSelectedScenarioId(null);
    setSelectedFilters(new Map());
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* 헤더 */}
      <div className="px-4 py-2 border-b bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs">
          <span className="font-semibold">Stress Test:</span>
          <span>시나리오: <strong>{scenarios.length}개</strong></span>
          {selectedScenario && (
            <>
              <span>|</span>
              <span>시리즈: <strong>{selectedScenario.dataProfile.seriesCount}개</strong></span>
              <span>시점: <strong>{selectedScenario.dataProfile.timePointCount}개</strong></span>
              {selectedScenario.dataProfile.hasOutliers && <span className="text-amber-600">이상치</span>}
              {selectedScenario.dataProfile.hasNegativeValues && <span className="text-red-600">음수</span>}
            </>
          )}
        </div>
        <button
          onClick={regenerateData}
          className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs font-medium hover:bg-primary/90"
        >
          새 데이터 생성
        </button>
      </div>

      {/* 메인 */}
      <div className="flex-1 flex min-h-0">
        {/* 좌측: 시나리오 패널 */}
        <div className="w-[320px] flex-shrink-0 flex flex-col border-r bg-muted/20 overflow-hidden">
          <div className="px-4 py-3 border-b">
            <h3 className="font-medium text-sm">피봇 시나리오</h3>
            <span className="text-xs text-muted-foreground">
              {filteredScenarios.length}/{scenarios.length}개 표시
            </span>
          </div>

          {/* 패싯 필터 */}
          <div className="px-3 py-2 border-b">
            <FacetFilter
              scenarios={scenarios}
              selectedFilters={selectedFilters}
              onFilterChange={handleFilterChange}
            />
          </div>

          {/* 시나리오 목록 */}
          <div className="flex-1 overflow-auto p-3 space-y-2">
            {filteredScenarios.map(scenario => (
              <ScenarioCard
                key={scenario.id}
                scenario={scenario}
                isSelected={selectedScenarioId === scenario.id}
                onSelect={() => setSelectedScenarioId(scenario.id)}
              />
            ))}
          </div>
        </div>

        {/* 중앙: 차트 */}
        <div className="flex-1 min-w-0 flex flex-col border-r">
          <div className="px-4 py-3 border-b">
            <h3 className="font-medium text-sm">{selectedScenario?.name || "차트"}</h3>
          </div>
          <div className="flex-1 min-h-0 p-4">
            {selectedScenario ? (
              <ErrorBoundary key={selectedScenarioId}>
                <ChartWidget
                  data={selectedScenario.data}
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
                  onTooltipChange={setTooltipPayload}
                  onHoveredLabelChange={setHoveredLabel}
                  onTreemapStatsChange={setTreemapStats}
                  onRegressionStatsChange={(stats) => stats && setRegressionStats({ r2: stats.rSquared })}
                />
              </ErrorBoundary>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                시나리오를 선택하세요
              </div>
            )}
          </div>
        </div>

        {/* 우측: 레전드 패널 */}
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
            onYAxisPlacementChange={(field, placement) => setYAxisPlacementsState(prev => ({ ...prev, [field]: placement }))}
            groupCount={groupCount}
            seriesGroupAssignments={seriesGroupState}
            onGroupCountChange={setGroupCount}
            onSeriesGroupChange={(field, group) => setSeriesGroupState(prev => ({ ...prev, [field]: group }))}
            syncedAreaLeftField={syncedAreaLeftField || undefined}
            syncedAreaRightField={syncedAreaRightField || undefined}
            onSyncedAreaFieldChange={(pos, field) => pos === 'left' ? setSyncedAreaLeftField(field) : setSyncedAreaRightField(field)}
            regressionScatterXField={regressionScatterXField || undefined}
            regressionScatterYField={regressionScatterYField || undefined}
            onRegressionScatterFieldChange={(axis, field) => axis === 'x' ? setRegressionScatterXField(field) : setRegressionScatterYField(field)}
            regressionStats={regressionStats}
            treemapStats={treemapStats}
            allowedChartTypes={selectedScenario?.allowedCharts || ALL_CHART_TYPES}
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
