"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import ChartWidget from "../src/components/ChartWidget";
import { ChartLegendPanel } from "../src/components/components/chart-legend-panel";
import { expandSeriesColors, getThemeColors } from "../src/components/components/recharts-wrapper";
import type { ChartType, YAxisPlacement } from "../src/types/chart-config";

// ============================================================
// sectorbook DataProfile 규약 (PivotContext.tsx 기반)
// ============================================================
interface DataProfile {
  seriesCount: number;
  timePointCount: number;
  hasNegativeValues: boolean;
  hasOutliers: boolean;
  xAxisType: "시점" | "범주" | "순서";
}

interface TableRules {
  columnOrder: string[];
  unitDisplay: string;
  dateSort: "asc" | "desc";
  nullHandling: "null";
}

interface PivotSpec {
  dataProfile: DataProfile;
  allowedCharts: string[];
  recommendedChart: string;
  tableRules: TableRules;
}

interface PivotDataRow {
  date: string;
  date_display: string;
  [key: string]: string | number | null;
}

// ============================================================
// sectorbook AccountMapping 규약 (Step 2 분류 결과)
// ============================================================
interface AccountMapping {
  original: string;        // 원본 계정항목명
  unit: string;            // 단위
  path: string[];          // 값 경로: ["에너지", "원유", "Brent"]
  criteriaPath: string[];  // 기준 경로: ["원자재성격별", "세부유형별", "벤치마크별"]
  displayPath: string;     // 표시용: "에너지 > 원유 > Brent"
}

// ============================================================
// sectorbook ScenarioCandidate 규약 (Step 3 시나리오)
// ============================================================
interface ScenarioCandidate {
  id: string;
  name: string;              // 분류기준명 (예: "상품유형")
  units: string[];           // 단위들
  accountGroup: string;      // 계정그룹명 (예: "에너지 > 상품유형")
  series: string[];          // 시리즈 값들 (표시용)
  originals: string[];       // 원본 계정항목명들
  seriesMapping: Record<string, string[]>;  // 시리즈 → 원본들
  aggregationLevel: string;
  status: "idle" | "selected" | "loading" | "done" | "error";
  scenario?: PivotScenario;
}

interface PivotScenario {
  id: string;
  name: string;
  accountGroup: string;
  unit: string;
  data: PivotDataRow[];
  spec?: PivotSpec;
  seriesUnits?: Record<string, string>;
}

// ============================================================
// 분류 계층 정의 (브랜치 구조)
// ============================================================
interface ClassificationBranch {
  criterion: string;      // 분류 기준 (예: "업종별")
  values: {
    name: string;         // 값 (예: "제조업")
    children?: ClassificationBranch;  // 하위 분류
  }[];
}

const CLASSIFICATION_TREE: ClassificationBranch[] = [
  {
    criterion: "업종별",
    values: [
      {
        name: "제조업",
        children: {
          criterion: "산업별",
          values: [
            { name: "자동차" },
            { name: "반도체" },
            { name: "철강" },
            { name: "조선" },
            { name: "섬유" },
          ],
        },
      },
      {
        name: "서비스업",
        children: {
          criterion: "업태별",
          values: [
            { name: "금융" },
            { name: "통신" },
            { name: "유통" },
            { name: "관광" },
            { name: "의료" },
          ],
        },
      },
      {
        name: "건설업",
        children: {
          criterion: "공종별",
          values: [
            { name: "토목" },
            { name: "건축" },
            { name: "플랜트" },
          ],
        },
      },
    ],
  },
  {
    criterion: "지역별",
    values: [
      {
        name: "수도권",
        children: {
          criterion: "시도별",
          values: [
            { name: "서울" },
            { name: "경기" },
            { name: "인천" },
          ],
        },
      },
      {
        name: "영남권",
        children: {
          criterion: "시도별",
          values: [
            { name: "부산" },
            { name: "대구" },
            { name: "울산" },
            { name: "경남" },
            { name: "경북" },
          ],
        },
      },
      {
        name: "호남권",
        children: {
          criterion: "시도별",
          values: [
            { name: "광주" },
            { name: "전남" },
            { name: "전북" },
          ],
        },
      },
    ],
  },
  {
    criterion: "품목별",
    values: [
      {
        name: "에너지",
        children: {
          criterion: "에너지원별",
          values: [
            { name: "석유" },
            { name: "가스" },
            { name: "석탄" },
            { name: "전력" },
          ],
        },
      },
      {
        name: "금속",
        children: {
          criterion: "금속종류별",
          values: [
            { name: "철강" },
            { name: "비철금속" },
            { name: "귀금속" },
          ],
        },
      },
    ],
  },
];

// 단위 풀
const UNIT_POOL = ["%", "억원", "천명", "개", "톤", "천대", "GWh", "백만달러"];

// 모든 차트 타입
const ALL_CHART_TYPES: ChartType[] = [
  "line", "area", "area-100", "stacked-area", "synced-area",
  "column", "mixed", "stacked", "stacked-100", "stacked-grouped", "dual-axis",
  "pie", "two-level-pie", "treemap", "multi-level-treemap",
  "ranking-bar", "regression-scatter"
];

// ============================================================
// Seeded Random
// ============================================================
function seededRandom(seed: number) {
  return function() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

// ============================================================
// 데이터 생성기 - AccountMapping 기반
// ============================================================
interface GeneratedData {
  accountMappings: AccountMapping[];
  scenarioCandidates: ScenarioCandidate[];
}

function generateDataFromClassificationTree(seed: number): GeneratedData {
  const random = seededRandom(seed);
  const accountMappings: AccountMapping[] = [];
  let accountIndex = 0;

  // 1~2개 분류 트리 선택
  const treeCount = Math.floor(random() * 2) + 1;
  const shuffledTrees = [...CLASSIFICATION_TREE].sort(() => random() - 0.5);
  const selectedTrees = shuffledTrees.slice(0, treeCount);

  // 각 트리에서 AccountMapping 생성
  for (const tree of selectedTrees) {
    const criterion1 = tree.criterion;  // 예: "업종별"

    // Level 1 값들 중 일부 선택
    const l1Count = Math.min(Math.floor(random() * 3) + 2, tree.values.length);
    const shuffledL1 = [...tree.values].sort(() => random() - 0.5);
    const selectedL1 = shuffledL1.slice(0, l1Count);

    for (const l1Value of selectedL1) {
      const unit = UNIT_POOL[Math.floor(random() * UNIT_POOL.length)];

      if (l1Value.children && random() > 0.3) {
        // Level 2가 있으면 하위 분류로 계정항목 생성
        const criterion2 = l1Value.children.criterion;  // 예: "산업별"
        const l2Count = Math.min(Math.floor(random() * 4) + 2, l1Value.children.values.length);
        const shuffledL2 = [...l1Value.children.values].sort(() => random() - 0.5);
        const selectedL2 = shuffledL2.slice(0, l2Count);

        for (const l2Value of selectedL2) {
          accountMappings.push({
            original: `${l2Value.name}_${++accountIndex}`,
            unit,
            path: [l1Value.name, l2Value.name],
            criteriaPath: [criterion1, criterion2],
            displayPath: `${l1Value.name} > ${l2Value.name}`,
          });
        }
      } else {
        // Level 1에서만 계정항목 생성
        accountMappings.push({
          original: `${l1Value.name}_${++accountIndex}`,
          unit,
          path: [l1Value.name],
          criteriaPath: [criterion1],
          displayPath: l1Value.name,
        });
      }
    }
  }

  // AccountMapping으로부터 ScenarioCandidate 생성 (sectorbook 로직)
  const scenarioCandidates = generateScenarioCandidatesFromMappings(accountMappings, random);

  return { accountMappings, scenarioCandidates };
}

// sectorbook의 generateScenarioCandidates 로직 재현
function generateScenarioCandidatesFromMappings(
  mappings: AccountMapping[],
  random: () => number
): ScenarioCandidate[] {
  const scenarios: ScenarioCandidate[] = [];
  let idCounter = 1;

  if (mappings.length === 0) return scenarios;

  // 분류기준 경로별로 그룹화
  interface CriterionGroup {
    criterionPath: string[];
    level: number;
    parentValuePath: string[];
    seriesValues: Set<string>;
    seriesMappings: Map<string, AccountMapping[]>;
  }

  const groups = new Map<string, CriterionGroup>();

  // 각 매핑을 순회하면서 분류기준별로 그룹화
  for (const mapping of mappings) {
    const { path, criteriaPath } = mapping;

    // 각 레벨별로 그룹 생성
    for (let level = 0; level < criteriaPath.length; level++) {
      const criterion = criteriaPath[level];
      if (!criterion) continue;

      // 분류기준 경로
      const criterionPathUpToLevel = criteriaPath.slice(0, level + 1);
      const criterionKey = criterionPathUpToLevel
        .map(c => c.replace(/별$/, ''))
        .join('/');

      // 부모 값 경로
      const parentValuePath = path.slice(0, level);

      // 그룹 키
      const groupKey = `${criterionKey}::${parentValuePath.join('/')}`;

      // 현재 레벨의 값
      const currentValue = path[level];
      if (!currentValue) continue;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          criterionPath: criterionPathUpToLevel,
          level,
          parentValuePath,
          seriesValues: new Set(),
          seriesMappings: new Map(),
        });
      }

      const group = groups.get(groupKey)!;
      group.seriesValues.add(currentValue);

      if (!group.seriesMappings.has(currentValue)) {
        group.seriesMappings.set(currentValue, []);
      }
      group.seriesMappings.get(currentValue)!.push(mapping);
    }
  }

  // 각 그룹에서 시나리오 생성 (시리즈가 2개 이상인 경우만)
  for (const [groupKey, group] of groups.entries()) {
    const { criterionPath, level, parentValuePath, seriesValues, seriesMappings } = group;

    if (seriesValues.size < 2) continue;

    // 시나리오명
    const scenarioName = criterionPath
      .map(c => c.replace(/별$/, ''))
      .join('/');

    const series = Array.from(seriesValues);

    // 시리즈별 원본 계정항목 매핑
    const seriesMapping: Record<string, string[]> = {};
    const allOriginals: string[] = [];
    const allUnits: string[] = [];

    for (const [seriesValue, mappingsForSeries] of seriesMappings.entries()) {
      const originals = mappingsForSeries.map(m => m.original);
      seriesMapping[seriesValue] = originals;
      allOriginals.push(...originals);

      // 단위 수집
      for (const m of mappingsForSeries) {
        if (m.unit && !allUnits.includes(m.unit)) {
          allUnits.push(m.unit);
        }
      }
    }

    // accountGroup
    const accountGroup = parentValuePath.length > 0
      ? `${parentValuePath.join(' > ')} > ${scenarioName}`
      : scenarioName;

    // 피봇 데이터 생성
    const pivotScenario = generatePivotScenario(
      `scenario-${idCounter}`,
      scenarioName,
      accountGroup,
      allUnits[0] || "%",
      series,
      random
    );

    scenarios.push({
      id: `scenario-${idCounter++}`,
      name: scenarioName,
      units: allUnits,
      accountGroup,
      series,
      originals: allOriginals,
      seriesMapping,
      aggregationLevel: accountGroup,
      status: "done",
      scenario: pivotScenario,
    });
  }

  return scenarios;
}

function generatePivotScenario(
  id: string,
  name: string,
  accountGroup: string,
  unit: string,
  series: string[],
  random: () => number
): PivotScenario {
  const timePointCount = Math.floor(random() * 20) + 8;
  const hasNegativeValues = random() > 0.6;
  const hasOutliers = random() > 0.5;
  const valueScale = Math.pow(10, Math.floor(random() * 3));

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

    series.forEach((field, idx) => {
      // 결측치 (5% 확률)
      if (random() < 0.05) {
        row[field] = null;
        return;
      }

      const baseValue = (random() * 5 + 1) * valueScale;
      const trend = Math.sin(i / (3 + idx)) * valueScale * 0.3;
      const noise = (random() - 0.5) * valueScale * 0.2;
      let value = baseValue + trend + noise;

      // 이상치
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

  // DataProfile 기반 허용 차트 결정
  const allowedCharts = determineAllowedCharts(series.length, hasNegativeValues);
  const recommendedChart = allowedCharts[0];

  return {
    id,
    name,
    accountGroup,
    unit,
    data,
    spec: {
      dataProfile: {
        seriesCount: series.length,
        timePointCount,
        hasNegativeValues,
        hasOutliers,
        xAxisType: "시점",
      },
      allowedCharts,
      recommendedChart,
      tableRules: {
        columnOrder: ["date_display", ...series],
        unitDisplay: unit,
        dateSort: "desc",
        nullHandling: "null",
      },
    },
  };
}

function determineAllowedCharts(seriesCount: number, hasNegativeValues: boolean): string[] {
  const charts: string[] = ["line", "column"];

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

// ============================================================
// UI Components
// ============================================================

// 분류 테이블 (Step 2 스타일)
interface ClassificationTableProps {
  mappings: AccountMapping[];
}

const ClassificationTable: React.FC<ClassificationTableProps> = ({ mappings }) => {
  const maxLevel = Math.max(...mappings.map(m => m.path.length), 0);

  return (
    <div className="overflow-x-auto overflow-y-auto h-full">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-muted">
          <tr className="border-b">
            <th className="text-left py-2 px-2 text-muted-foreground font-medium whitespace-nowrap">원본</th>
            <th className="text-left py-2 px-2 text-muted-foreground font-medium whitespace-nowrap">단위</th>
            {Array.from({ length: maxLevel }, (_, i) => (
              <React.Fragment key={i}>
                <th className="text-left py-2 px-2 text-violet-500 font-medium whitespace-nowrap bg-violet-50">
                  기준{i + 1}
                </th>
                <th className="text-left py-2 px-2 text-cyan-600 font-medium whitespace-nowrap">
                  값{i + 1}
                </th>
              </React.Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {mappings.map((mapping, index) => (
            <tr key={index} className="border-b border-border/50 hover:bg-muted/50">
              <td className="py-1.5 px-2 font-mono whitespace-nowrap">{mapping.original}</td>
              <td className="py-1.5 px-2 text-amber-600 whitespace-nowrap">{mapping.unit}</td>
              {Array.from({ length: maxLevel }, (_, i) => (
                <React.Fragment key={i}>
                  <td className="py-1.5 px-2 text-violet-500 whitespace-nowrap bg-violet-50/30">
                    {mapping.criteriaPath?.[i]?.replace(/별$/, '') || "-"}
                  </td>
                  <td className="py-1.5 px-2 text-cyan-600 whitespace-nowrap">
                    {mapping.path[i] || "-"}
                  </td>
                </React.Fragment>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// 패싯 필터 (sectorbook 스타일 - 수평 필 버튼)
interface FacetFilterProps {
  accountMappings: AccountMapping[];
  selectedFilters: Map<number, string>;
  onFilterChange: (level: number, value: string | null) => void;
}

const FacetFilter: React.FC<FacetFilterProps> = ({
  accountMappings,
  selectedFilters,
  onFilterChange,
}) => {
  // 레벨별 분류기준과 값 추출
  const facets = useMemo(() => {
    const result: { level: number; criterion: string; values: Set<string> }[] = [];

    for (const mapping of accountMappings) {
      const { criteriaPath, path } = mapping;

      for (let level = 0; level < criteriaPath.length; level++) {
        const criterion = criteriaPath[level];
        const value = path[level];
        if (!criterion || !value) continue;

        // 상위 레벨 필터 확인
        let matchesFilter = true;
        for (let i = 0; i < level; i++) {
          const selectedValue = selectedFilters.get(i);
          if (selectedValue && path[i] !== selectedValue) {
            matchesFilter = false;
            break;
          }
        }
        if (!matchesFilter) continue;

        let facet = result.find(f => f.level === level);
        if (!facet) {
          facet = { level, criterion, values: new Set() };
          result.push(facet);
        }
        facet.values.add(value);
      }
    }

    result.sort((a, b) => a.level - b.level);
    return result;
  }, [accountMappings, selectedFilters]);

  if (facets.length === 0) return null;

  return (
    <div className="space-y-2">
      {facets.map(({ level, criterion, values }) => {
        const selectedValue = selectedFilters.get(level);
        const valuesArray = Array.from(values).sort();

        return (
          <div key={level} className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-violet-600 min-w-[60px]">
              {criterion.replace(/별$/, '')}:
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
                        : 'bg-muted text-muted-foreground hover:bg-violet-100 hover:text-violet-700'
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
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          필터 초기화
        </button>
      )}
    </div>
  );
};

// 시나리오 후보 카드 (sectorbook ScenarioCandidateCard 스타일)
interface ScenarioCandidateCardProps {
  candidate: ScenarioCandidate;
  isChartSelected: boolean;
  onChartSelect: () => void;
}

const ScenarioCandidateCard: React.FC<ScenarioCandidateCardProps> = ({
  candidate,
  isChartSelected,
  onChartSelect,
}) => {
  const [expanded, setExpanded] = useState(false);
  const { scenario } = candidate;
  const spec = scenario?.spec;

  return (
    <div
      onClick={onChartSelect}
      className={`rounded-lg border transition-all cursor-pointer ${
        isChartSelected
          ? 'bg-cyan-50 border-cyan-400 shadow-md ring-2 ring-cyan-300'
          : 'bg-card border-border shadow-sm hover:bg-muted/50'
      }`}
    >
      <div className="flex items-center justify-between p-3 hover:bg-cyan-50/50">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-green-500">✓</span>
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="p-0.5 hover:bg-muted rounded"
          >
            {expanded ? '▼' : '▶'}
          </button>
          <span className="font-medium text-sm">{candidate.name}</span>
          <span className="text-xs text-muted-foreground">|</span>
          <span className="text-xs text-muted-foreground">{candidate.series.length}개 항목</span>
          <span className="text-xs text-muted-foreground">|</span>
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
            {candidate.units.join(", ")}
          </span>
          {candidate.units.length > 1 && (
            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
              이중축 필요
            </span>
          )}
          <span className="text-xs bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded">
            {scenario?.data.length || 0} rows
          </span>
          {spec && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
              추천: {spec.recommendedChart}
            </span>
          )}
          {isChartSelected && (
            <span className="text-xs bg-cyan-500 text-white px-2 py-0.5 rounded">
              차트 표시중
            </span>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t bg-muted/30">
          {/* 명세 정보 */}
          {spec && (
            <div className="p-3 border-b text-xs">
              <h5 className="font-semibold text-muted-foreground mb-2">📊 명세</h5>
              <div className="mb-2">
                <span className="text-muted-foreground">데이터 특성: </span>
                <span>
                  {spec.dataProfile.seriesCount}개 시리즈 · {spec.dataProfile.timePointCount}개 시점
                  {spec.dataProfile.hasNegativeValues && " · 음수포함"}
                  {spec.dataProfile.hasOutliers && " · 이상치"}
                </span>
              </div>
              <div className="mb-2">
                <span className="text-muted-foreground block mb-1">허용 차트:</span>
                <div className="flex flex-wrap gap-1">
                  {spec.allowedCharts.map((chart) => (
                    <span
                      key={chart}
                      className={`px-1.5 py-0.5 rounded ${
                        chart === spec.recommendedChart
                          ? 'bg-purple-200 text-purple-800 font-medium'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {chart}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
          {/* 시리즈 목록 */}
          <div className="p-3 text-xs">
            <span className="text-muted-foreground block mb-1">포함 시리즈:</span>
            <div className="flex flex-wrap gap-1">
              {candidate.series.map((s, i) => (
                <span key={i} className="bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded">
                  {s}
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

  // 데이터 생성
  const { accountMappings, scenarioCandidates } = useMemo(
    () => generateDataFromClassificationTree(dataSeed),
    [dataSeed]
  );

  // 선택된 시나리오 ID
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);

  // 패싯 필터
  const [selectedFilters, setSelectedFilters] = useState<Map<number, string>>(new Map());

  // 필터링된 시나리오
  const filteredScenarios = useMemo(() => {
    if (selectedFilters.size === 0) return scenarioCandidates;

    return scenarioCandidates.filter((candidate) => {
      // 시나리오의 accountGroup 분석
      const pathParts = candidate.accountGroup.split(' > ').map(p => p.trim());

      // 각 필터 레벨 확인
      for (const [level, filterValue] of selectedFilters.entries()) {
        // 시나리오의 series에 필터 값이 포함되어 있는지
        if (candidate.series.includes(filterValue)) continue;

        // accountGroup 경로에 필터 값이 포함되어 있는지
        if (pathParts.includes(filterValue)) continue;

        // 시나리오에 연결된 원본 계정항목들의 경로 확인
        const matchingMapping = accountMappings.find(m =>
          candidate.originals.includes(m.original) && m.path[level] === filterValue
        );
        if (matchingMapping) continue;

        return false;
      }

      return true;
    });
  }, [scenarioCandidates, selectedFilters, accountMappings]);

  // 선택된 시나리오
  const selectedScenario = useMemo(() => {
    const found = scenarioCandidates.find(s => s.id === selectedScenarioId);
    return found || filteredScenarios[0] || null;
  }, [scenarioCandidates, selectedScenarioId, filteredScenarios]);

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
    if (selectedScenario?.scenario?.spec) {
      setChartType(selectedScenario.scenario.spec.recommendedChart as ChartType);
    }
  }, [selectedScenario]);

  // 시리즈 상태
  const seriesFields = selectedScenario?.series || [];
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
    if (chartType !== "ranking-bar" || !selectedScenario?.scenario) return null;
    const lastData = selectedScenario.scenario.data[selectedScenario.scenario.data.length - 1];
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

  const spec = selectedScenario?.scenario?.spec;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* 헤더 */}
      <div className="px-4 py-2 border-b bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs">
          <span className="font-semibold">sectorbook Chart Widget 스트레스 테스트</span>
          <span>계정항목: <strong>{accountMappings.length}개</strong></span>
          <span>시나리오: <strong>{scenarioCandidates.length}개</strong></span>
          {spec && (
            <>
              <span>|</span>
              <span>시리즈: <strong>{spec.dataProfile.seriesCount}개</strong></span>
              <span>시점: <strong>{spec.dataProfile.timePointCount}개</strong></span>
              {spec.dataProfile.hasOutliers && <span className="text-amber-600">이상치</span>}
              {spec.dataProfile.hasNegativeValues && <span className="text-red-600">음수</span>}
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
        <div className="w-[360px] flex-shrink-0 flex flex-col border-r bg-muted/20 overflow-hidden">
          {/* 계정항목 분류 (Step 2) */}
          <div className="flex-shrink-0 border-b">
            <div className="px-4 py-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold">계정항목 분류</h4>
              <span className="text-xs text-muted-foreground">{accountMappings.length}개</span>
            </div>
            <div className="h-32 overflow-hidden">
              <ClassificationTable mappings={accountMappings} />
            </div>
          </div>

          {/* 피봇 시나리오 (Step 3) */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-4 py-2 border-b flex items-center justify-between">
              <h4 className="text-sm font-semibold">피봇 시나리오</h4>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                  {selectedFilters.size > 0
                    ? `${filteredScenarios.length}/${scenarioCandidates.length}개`
                    : `${scenarioCandidates.length}개`
                  } 완료
                </span>
              </div>
            </div>

            {/* 패싯 필터 */}
            {accountMappings.length > 0 && (
              <div className="px-3 py-2 border-b bg-muted/30">
                <FacetFilter
                  accountMappings={accountMappings}
                  selectedFilters={selectedFilters}
                  onFilterChange={handleFilterChange}
                />
              </div>
            )}

            {/* 시나리오 목록 */}
            <div className="flex-1 overflow-auto p-3 space-y-1.5 min-h-0">
              {filteredScenarios.map((candidate) => (
                <ScenarioCandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  isChartSelected={selectedScenarioId === candidate.id}
                  onChartSelect={() => setSelectedScenarioId(candidate.id)}
                />
              ))}

              {filteredScenarios.length === 0 && selectedFilters.size > 0 && (
                <div className="text-center py-4 text-xs text-muted-foreground">
                  선택한 필터에 해당하는 시나리오가 없습니다
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 중앙: 차트 */}
        <div className="flex-1 min-w-0 flex flex-col border-r">
          <div className="px-4 py-3 border-b">
            <h3 className="font-medium text-sm">{selectedScenario?.name || "차트"}</h3>
            {selectedScenario && (
              <span className="text-xs text-muted-foreground">{selectedScenario.accountGroup}</span>
            )}
          </div>
          <div className="flex-1 min-h-0 p-4">
            {selectedScenario?.scenario ? (
              <ErrorBoundary key={selectedScenarioId}>
                <ChartWidget
                  data={selectedScenario.scenario.data}
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
            allowedChartTypes={spec?.allowedCharts.map(c => c as ChartType) || ALL_CHART_TYPES}
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
