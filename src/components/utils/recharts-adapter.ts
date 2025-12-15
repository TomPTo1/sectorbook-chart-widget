import type {
  ChartType,
  OutlierInfo,
  MissingValueInfo,
  RegionClassifiedData,
  ExtendedDataAnalysisResult,
  ChartDataItem,
  UnitSettings,
} from "@/types/chart-config";

// 로컬 타입 정의
type DatetimeType = "minute" | "hour" | "day" | "week" | "month" | "quarter" | "year";
type ChartData = ChartDataItem;
type SeriesIQRInfo = {
  field: string;
  q1: number;
  q3: number;
  lower: number;
  upper: number;
};

// AI 차트 설정 타입
interface AIChartConfig {
  chartType: ChartType;
  data: ChartDataItem[];
  xField: string;
  yFields: string[];
  showLegend?: boolean;
  showTooltip?: boolean;
}

// 데이터 분석 결과 타입
interface DataAnalysisResult {
  outliers: OutlierInfo[];
  missingValues: MissingValueInfo[];
  iqrBounds: Record<string, { lower: number; upper: number; q1: number; q3: number }>;
  seriesIQR: SeriesIQRInfo[];
}
import { format, getISOWeek, getISOWeekYear } from "date-fns";

/** datetime_type별 한글 레이블 */
const DATETIME_TYPE_LABELS: Record<DatetimeType, string> = {
  minute: "분",
  hour: "시간",
  day: "일",
  week: "주",
  month: "월",
  quarter: "분기",
  year: "연도",
};

/**
 * datetime_type에 따른 그룹 키 생성
 */
export function getGroupKey(date: Date, datetimeType: DatetimeType): string {
  switch (datetimeType) {
    case "minute":
      return format(date, "yyyy-MM-dd HH:mm");
    case "hour":
      return format(date, "yyyy-MM-dd HH:00");
    case "day":
      return format(date, "yyyy-MM-dd");
    case "week":
      return `${getISOWeekYear(date)}-W${String(getISOWeek(date)).padStart(2, "0")}`;
    case "month":
      return format(date, "yyyy-MM");
    case "quarter":
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      return `${date.getFullYear()}-Q${quarter}`;
    case "year":
      return format(date, "yyyy");
  }
}

/**
 * X축 레이블용 날짜 포맷 변환
 * 연도 단위를 제외한 모든 datetime_type에서 4자리 연도를 2자리로 변경
 */
export function formatDateForXAxis(dateDisplay: string): string {
  if (!dateDisplay) return dateDisplay;

  // 연도 단위 패턴: 정확히 4자리 숫자만
  if (/^\d{4}$/.test(dateDisplay)) {
    return dateDisplay; // 연도는 4자리 유지
  }

  // 4자리 연도를 2자리로 변환 (문자열 시작 부분)
  return dateDisplay.replace(/^(\d{4})/, (match) => match.slice(2));
}

/**
 * ChartData 배열에서 계정항목(시리즈) 필드들을 추출
 */
export function extractSeriesFields(data: ChartData[]): string[] {
  if (!data.length) return [];

  const firstItem = data[0];
  const reservedFields = ["date", "date_display"];

  return Object.keys(firstItem).filter(
    (key) => !reservedFields.includes(key) && typeof firstItem[key] === "number"
  );
}

/**
 * UnitSettings의 datetime_range에 따라 데이터 필터링
 */
export function filterDataByDateRange(
  data: ChartData[],
  unitSettings: UnitSettings
): ChartData[] {
  const { datetime_start, datetime_end } = unitSettings.datetime_range;

  if (!datetime_start && !datetime_end) {
    return data;
  }

  const startTime = datetime_start ? new Date(datetime_start).getTime() : -Infinity;
  const endTime = datetime_end ? new Date(datetime_end).getTime() : Infinity;

  return data.filter((item) => {
    if (!item.date) return true;
    const itemTime = new Date(item.date).getTime();
    return itemTime >= startTime && itemTime <= endTime;
  });
}

/**
 * datetime_type에 따라 데이터를 집계
 * 예: 일별 데이터 → 월별 합계
 */
export function aggregateDataByUnit(
  data: ChartData[],
  unitSettings: UnitSettings
): ChartData[] {
  if (data.length === 0) return data;

  const { datetime_type } = unitSettings;

  // 그룹별 합계
  const groups = new Map<string, ChartData>();
  const numericFields = extractSeriesFields(data);

  for (const item of data) {
    if (!item.date) continue;
    const key = getGroupKey(new Date(item.date), datetime_type);
    if (!groups.has(key)) {
      groups.set(key, { date: key, date_display: key });
    }
    const group = groups.get(key)!;
    for (const field of numericFields) {
      group[field] = ((group[field] as number) || 0) + (item[field] as number);
    }
  }

  return Array.from(groups.values()).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
}

/**
 * ChartData 배열을 AIChartConfig로 변환
 */
export function chartDataToAIConfig(
  data: ChartData[],
  chartType: ChartType = "line"
): AIChartConfig {
  const yFields = extractSeriesFields(data);

  return {
    chartType,
    data: data.map((item) => ({
      ...item,
    })),
    xField: "date_display",
    yFields,
    showLegend: true,
    showTooltip: true,
  };
}

/**
 * ChartData 배열을 Recharts용 데이터로 변환
 */
export function chartDataToRechartsData(
  data: ChartData[],
  options?: {
    unitSettings?: UnitSettings;
  }
): ChartData[] {
  // UnitSettings가 있으면 데이터 필터링 + 재집계 적용
  let processedData = options?.unitSettings
    ? filterDataByDateRange(data, options.unitSettings)
    : data;

  if (options?.unitSettings) {
    processedData = aggregateDataByUnit(processedData, options.unitSettings);
  }

  return processedData;
}

/**
 * 인풋 JSON 데이터를 ChartData 형식으로 파싱
 */
export function parseInputDataToChartData(inputJson: string): ChartData[] {
  try {
    const parsed = JSON.parse(inputJson);

    if (!Array.isArray(parsed)) {
      throw new Error("데이터는 배열 형식이어야 합니다");
    }

    return parsed.map((item) => {
      if (!item.date && !item.date_display) {
        throw new Error("각 데이터 항목에는 date 또는 date_display 필드가 필요합니다");
      }

      return {
        date: item.date || item.date_display,
        date_display: item.date_display || item.date,
        ...item,
      };
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("유효하지 않은 JSON 형식입니다");
    }
    throw error;
  }
}

/**
 * datetime_type의 한글 레이블 반환
 */
export function getDatetimeTypeLabel(type: DatetimeType): string {
  return DATETIME_TYPE_LABELS[type] || "";
}

/**
 * 1.5 IQR 방식으로 이상치/결측치 분석
 */
export function analyzeDataQuality(
  data: ChartData[],
  fields: string[]
): DataAnalysisResult {
  const outliers: OutlierInfo[] = [];
  const missingValues: MissingValueInfo[] = [];
  const iqrBounds: Record<string, { lower: number; upper: number; q1: number; q3: number }> = {};

  // 각 필드별 IQR 계산
  for (const field of fields) {
    const values = data
      .map((d) => d[field])
      .filter((v): v is number => typeof v === "number" && !isNaN(v))
      .sort((a, b) => a - b);

    if (values.length < 4) continue;

    const q1Index = Math.floor(values.length * 0.25);
    const q3Index = Math.floor(values.length * 0.75);
    const q1 = values[q1Index];
    const q3 = values[q3Index];
    const iqr = q3 - q1;

    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;

    iqrBounds[field] = { lower, upper, q1, q3 };

    // 이상치 검출
    for (const item of data) {
      const value = item[field];
      if (typeof value === "number" && !isNaN(value)) {
        if (value < lower) {
          outliers.push({
            date_display: item.date_display,
            field,
            value,
            bound: "lower",
          });
        } else if (value > upper) {
          outliers.push({
            date_display: item.date_display,
            field,
            value,
            bound: "upper",
          });
        }
      }
    }
  }

  // 결측치 검출
  for (const item of data) {
    for (const f of fields) {
      const v = item[f];
      if (v === null || v === undefined || (typeof v === "number" && isNaN(v))) {
        missingValues.push({
          date_display: item.date_display,
          field: f,
        });
      }
    }
  }

  return { outliers, missingValues, iqrBounds, seriesIQR: [] };
}

/**
 * 이상치를 Scatter 데이터로 변환
 */
export function outliersToScatterData(
  outliers: OutlierInfo[]
): Array<{ x: string; y: number; field: string }> {
  return outliers.map((o) => ({
    x: o.date_display,
    y: o.value,
    field: o.field,
  }));
}

/**
 * 데이터를 Upper/Normal/Lower 영역으로 분류
 * - Upper: 하나라도 상한 초과
 * - Lower: 하나라도 하한 미만
 * - Normal: 모든 필드가 범위 내 (이상치 필드는 null로 마스킹)
 */
export function classifyDataByRegion(
  data: ChartData[],
  fields: string[],
  iqrBounds: Record<string, { lower: number; upper: number; q1: number; q3: number }>,
  outliers: OutlierInfo[] = [],
  allFields?: string[]
): RegionClassifiedData {
  const upperData: ChartDataItem[] = [];
  const normalData: ChartDataItem[] = [];
  const lowerData: ChartDataItem[] = [];

  // Step 1: 이상치 인덱싱 (빠른 조회를 위해)
  const outlierMap = new Map<string, Map<string, 'upper' | 'lower'>>();
  for (const outlier of outliers) {
    if (!outlierMap.has(outlier.date_display)) {
      outlierMap.set(outlier.date_display, new Map());
    }
    outlierMap.get(outlier.date_display)!.set(outlier.field, outlier.bound);
  }

  // Step 2: 데이터 분류
  for (const item of data) {
    const dateOutliers = outlierMap.get(item.date_display);

    let hasUpper = false;
    let hasLower = false;

    // Normal용 데이터: 이상치 필드는 null로 마스킹
    const normalItem: ChartDataItem = {
      date: item.date,
      date_display: item.date_display,
    };

    for (const field of fields) {
      const fieldValue = item[field];
      const outlierBound = dateOutliers?.get(field);

      if (outlierBound === 'upper') {
        hasUpper = true;
        normalItem[field] = null;  // 이상치는 null로 설정
      } else if (outlierBound === 'lower') {
        hasLower = true;
        normalItem[field] = null;  // 이상치는 null로 설정
      } else {
        normalItem[field] = fieldValue;  // 정상값 유지
      }
    }

    // 비분석 필드 처리 (좌측 필드 등 - 이중축 차트용)
    if (allFields) {
      const nonAnalyzedFields = allFields.filter(f => !fields.includes(f));
      for (const field of nonAnalyzedFields) {
        normalItem[field] = item[field];  // 항상 값 유지
      }
    }

    // Normal 데이터는 항상 추가 (null 마스킹 적용됨)
    normalData.push(normalItem);

    // Upper/Lower: 이상치 포함 날짜만 추가 (모든 값 포함)
    if (hasUpper) {
      upperData.push({
        ...item,
        date: item.date,
        date_display: item.date_display,
      });
    }
    if (hasLower) {
      lowerData.push({
        ...item,
        date: item.date,
        date_display: item.date_display,
      });
    }
  }

  // Step 3: Domain 계산
  const upperOutlierValues = outliers
    .filter((o) => o.bound === "upper")
    .map((o) => o.value);

  const lowerOutlierValues = outliers
    .filter((o) => o.bound === "lower")
    .map((o) => o.value);

  const calculateOutlierDomain = (
    values: number[],
    normalDomain: [number, number],
    bound: 'upper' | 'lower'
  ): [number, number] => {
    // 이상치가 없으면 Normal 영역 기준으로 마진 추가한 도메인 반환
    if (values.length === 0) {
      const normalRange = normalDomain[1] - normalDomain[0];
      const margin = Math.max(normalRange * 0.1, 10);
      if (bound === 'upper') {
        return [normalDomain[1] + margin * 0.5, normalDomain[1] + margin];
      } else {
        return [normalDomain[0] - margin, normalDomain[0] - margin * 0.5];
      }
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;

    // Normal 영역과의 간격 (Normal 범위의 5% 또는 최소 5)
    const normalRange = normalDomain[1] - normalDomain[0];
    const gap = Math.max(normalRange * 0.05, 5);

    // Padding 계산 (범위가 좁을 때 작은 값 사용)
    const effectivePadding = range > 0
      ? range * 0.1
      : Math.min(Math.abs(max) * 0.05, 10);

    if (bound === 'upper') {
      // Upper: 최소값이 Normal 최대값 + gap 이상
      const minBound = normalDomain[1] + gap;
      const naturalMin = min - effectivePadding;

      // Normal 영역 침범 방지: minBound를 절대 밑돌지 않음
      const finalMin = Math.max(naturalMin, minBound);

      // 최소 범위 보장
      const minRange = Math.max(gap * 0.5, 1);
      const adjustedMax = Math.max(
        max + effectivePadding,
        finalMin + minRange
      );

      return [finalMin, adjustedMax];
    } else {
      // Lower: 최대값이 Normal 최소값 - gap 이하
      const maxBound = normalDomain[0] - gap;
      const naturalMax = max + effectivePadding;

      // Normal 영역 침범 방지: maxBound를 절대 넘지 않음
      const finalMax = Math.min(naturalMax, maxBound);

      // 최소 범위 보장
      const minRange = Math.max(gap * 0.5, 1);
      const adjustedMin = Math.min(
        min - effectivePadding,
        finalMax - minRange
      );

      return [adjustedMin, finalMax];
    }
  };

  const calculateNormalDomain = (): [number, number] => {
    let globalLower = Infinity;
    let globalUpper = -Infinity;

    for (const field of fields) {
      const bounds = iqrBounds[field];
      if (bounds) {
        globalLower = Math.min(globalLower, bounds.lower);
        globalUpper = Math.max(globalUpper, bounds.upper);
      }
    }

    if (globalLower === Infinity || globalUpper === -Infinity) {
      return [0, 100];
    }

    // Padding을 작게 설정하여 upper/lower domain과 겹치지 않도록 함
    const padding = (globalUpper - globalLower) * 0.05 || 5;
    return [globalLower - padding, globalUpper + padding];
  };

  // Step 3-1: Normal 도메인 먼저 계산 (기준점)
  const normalDomain = calculateNormalDomain();

  // Step 3-2: Normal을 기준으로 Upper/Lower 도메인 계산
  const upperDomain = calculateOutlierDomain(
    upperOutlierValues,
    normalDomain,
    'upper'
  );

  const lowerDomain = calculateOutlierDomain(
    lowerOutlierValues,
    normalDomain,
    'lower'
  );

  return {
    upper: {
      data: upperData,
      domain: upperDomain,
      hasData: upperData.length > 0,
    },
    normal: {
      data: normalData,
      domain: normalDomain,
    },
    lower: {
      data: lowerData,
      domain: lowerDomain,
      hasData: lowerData.length > 0,
    },
  };
}

/**
 * 영역별 높이 비율 계산 (도메인 범위 기반)
 */
export function calculateRegionHeights(
  classifiedData: RegionClassifiedData,
  totalHeight: number,
  minHeight: number = 50
): { upper: number; normal: number; lower: number } {
  const hasUpper = classifiedData.upper.hasData;
  const hasLower = classifiedData.lower.hasData;

  // 이상치 영역이 없으면 전체를 normal에 할당
  if (!hasUpper && !hasLower) {
    return { upper: 0, normal: totalHeight, lower: 0 };
  }

  // 고정 비율로 높이 계산 (normal 영역이 잘 보이도록)
  const NORMAL_RATIO = 0.70;  // normal 영역 70%
  const OUTLIER_RATIO = 0.30; // 이상치 영역 30%

  let upperHeight = 0;
  let lowerHeight = 0;
  let normalHeight = totalHeight * NORMAL_RATIO;

  if (hasUpper && hasLower) {
    // 둘 다 있으면 15%씩
    upperHeight = Math.max((totalHeight * OUTLIER_RATIO) / 2, minHeight);
    lowerHeight = Math.max((totalHeight * OUTLIER_RATIO) / 2, minHeight);
  } else if (hasUpper) {
    upperHeight = Math.max(totalHeight * OUTLIER_RATIO, minHeight);
  } else if (hasLower) {
    lowerHeight = Math.max(totalHeight * OUTLIER_RATIO, minHeight);
  }

  // 최종 normalHeight 조정 (upper/lower가 최소 높이로 인해 커진 경우)
  normalHeight = totalHeight - upperHeight - lowerHeight;

  return { upper: upperHeight, normal: normalHeight, lower: lowerHeight };
}

/**
 * 이상치를 제외한 정상 데이터만 필터링
 */
export function filterOutliersFromData(
  data: ChartData[],
  fields: string[],
  iqrBounds: Record<string, { lower: number; upper: number; q1: number; q3: number }>
): ChartData[] {
  return data.filter((item) => {
    for (const field of fields) {
      const value = item[field];
      const bounds = iqrBounds[field];

      if (typeof value === "number" && !isNaN(value) && bounds) {
        if (value < bounds.lower || value > bounds.upper) {
          return false;
        }
      }
    }
    return true;
  });
}

/**
 * 확장된 데이터 품질 분석 (영역 분류 포함)
 */
export function analyzeDataQualityExtended(
  data: ChartData[],
  fields: string[],
  allFields?: string[]
): ExtendedDataAnalysisResult {
  // 기본 분석 수행
  const basicResult = analyzeDataQuality(data, fields);

  // 시리즈별 IQR 정보 생성
  const seriesIQR: SeriesIQRInfo[] = Object.entries(basicResult.iqrBounds).map(
    ([field, bounds]) => ({
      field,
      q1: bounds.q1,
      q3: bounds.q3,
      lower: bounds.lower,
      upper: bounds.upper,
    })
  );

  // 데이터 영역 분류 (outliers 전달하여 올바른 domain 계산)
  const classifiedData = classifyDataByRegion(data, fields, basicResult.iqrBounds, basicResult.outliers, allFields);

  return {
    ...basicResult,
    seriesIQR,
    classifiedData,
    hasUpperOutliers: classifiedData.upper.hasData ?? false,
    hasLowerOutliers: classifiedData.lower.hasData ?? false,
  };
}

/**
 * 파이 차트용 시리즈별 합계 계산
 * 각 시리즈의 전체 기간 합계를 파이 조각으로 변환
 */
export function calculateSeriesSums(
  data: ChartData[],
  fields: string[]
): Array<{ name: string; value: number }> {
  return fields.map(field => {
    let sum = 0;
    for (const item of data) {
      const value = item[field];
      if (typeof value === "number" && !isNaN(value)) {
        sum += value;
      }
    }
    return { name: field, value: sum };
  });
}

/**
 * 2단계 파이 차트용 데이터 변환
 * - innerData: 시리즈별 합계 (내부 원)
 * - outerData: 시리즈별 연도별 합계 (외부 링)
 */
export function calculateTwoLevelPieData(
  data: ChartData[],
  fields: string[]
): {
  innerData: Array<{ name: string; value: number }>;
  outerData: Array<{ name: string; value: number; series: string }>;
} {
  // innerData: 시리즈별 합계
  const innerData = calculateSeriesSums(data, fields);

  // outerData: 시리즈별 연도별 합계
  // 1. 연도별 집계 맵 생성
  const yearSums: Map<string, Map<string, number>> = new Map();

  for (const item of data) {
    // date에서 연도 추출
    if (!item.date) continue;
    const year = new Date(item.date).getFullYear().toString();

    for (const field of fields) {
      const value = item[field];
      if (typeof value === "number" && !isNaN(value)) {
        if (!yearSums.has(field)) {
          yearSums.set(field, new Map());
        }
        const fieldMap = yearSums.get(field)!;
        fieldMap.set(year, (fieldMap.get(year) || 0) + value);
      }
    }
  }

  // 2. 집계된 데이터를 outerData 배열로 변환
  const outerData: Array<{ name: string; value: number; series: string }> = [];
  for (const field of fields) {
    const fieldMap = yearSums.get(field);
    if (fieldMap) {
      // 연도순 정렬
      const sortedYears = Array.from(fieldMap.keys()).sort();
      for (const year of sortedYears) {
        outerData.push({
          name: `${field}_${year}`,
          value: fieldMap.get(year)!,
          series: field,
        });
      }
    }
  }

  return { innerData, outerData };
}

/** 트리맵 자식 노드 타입 */
export interface TreemapChildItem {
  name: string;
  size: number;
  seriesName: string;
}

/** 트리맵 데이터 아이템 타입 */
export interface TreemapDataItem {
  name: string;
  children: TreemapChildItem[];
}

/** 멀티레벨 트리맵 노드 타입 */
export interface MultiLevelTreemapNode {
  name: string;
  size?: number;
  seriesName?: string;
  children?: MultiLevelTreemapNode[];
}

/**
 * 트리맵 차트용 데이터 변환
 * 시리즈를 부모로, 날짜별 값을 자식으로 변환
 * 양수 값만 사용 (Math.abs 적용)
 */
export function calculateTreemapData(
  data: ChartData[],
  fields: string[]
): TreemapDataItem[] {
  return fields.map(field => {
    const children: TreemapChildItem[] = [];

    for (const item of data) {
      const value = item[field];
      if (typeof value === "number" && !isNaN(value)) {
        const absValue = Math.abs(value);
        if (absValue > 0) {
          children.push({
            name: item.date_display || item.date || "",
            size: absValue,
            seriesName: field,
          });
        }
      }
    }

    return {
      name: field,
      children,
    };
  }).filter(item => item.children.length > 0);
}
